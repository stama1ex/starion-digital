import { prisma } from '@/lib/db';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';
import { resolveItemPrice, calculateVatAmount } from '@/lib/orders/pricing';
import { buildCreatedAt } from '@/lib/orders/dates';
import { applyRealizationConfirmSideEffect } from '@/lib/orders/status';
import { sendEmail } from '@/lib/email/transport';
import { toPlain } from '@/lib/toPlain';
import { naturalCompare } from '@/lib/naturalSort';

// Партнёр может редактировать позиции только пока заказ ещё НЕ подтверждён -
// после подтверждения он уже в работе. Админ (и супер-админ) действует по
// более широким правилам и может править ещё и подтверждённые заказы.
const PARTNER_EDITABLE_STATUSES = ['NEW'];
const ADMIN_EDITABLE_STATUSES = ['NEW', 'CONFIRMED'];

async function loadOrderForEdit(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          prices: { select: { type: true, groupId: true, price: true } },
        },
      },
      items: { include: { product: true } },
    },
  });
}

function checkEditPermission(
  caller: { id: number; role: string },
  order: { partnerId: number },
) {
  const isOwner = caller.role === 'PARTNER' && order.partnerId === caller.id;
  const isSuperAdmin = caller.role === 'SUPER_ADMIN';
  return { allowed: isOwner || isSuperAdmin, isOwner };
}

function getEditBlockReason(
  order: { isRealization: boolean; status: string },
  isOwner: boolean,
) {
  if (order.isRealization) {
    return 'Заказы на реализацию нельзя редактировать';
  }
  const allowedStatuses = isOwner
    ? PARTNER_EDITABLE_STATUSES
    : ADMIN_EDITABLE_STATUSES;
  if (!allowedStatuses.includes(order.status)) {
    return isOwner
      ? 'Редактирование доступно только для новых заказов'
      : 'Редактирование доступно только для новых или подтверждённых заказов';
  }
  return null;
}

// === GET: данные заказа + доступные для добавления товары ===
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const caller = await getPartnerFromSessionCookie();
    if (!caller) return new Response('Unauthorized', { status: 401 });

    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return new Response('Invalid order id', { status: 400 });
    }

    const order = await loadOrderForEdit(orderId);
    if (!order) return new Response('Order not found', { status: 404 });

    const { allowed, isOwner } = checkEditPermission(caller, order);
    if (!allowed) return new Response('Forbidden', { status: 403 });

    const reason = getEditBlockReason(order, isOwner);
    const customPrices =
      (order.customPrices as Record<string, unknown> | null) || {};

    const [allProducts, defaultPrices] = await Promise.all([
      prisma.product
        .findMany({
          where: { isHidden: false },
          orderBy: { number: 'asc' },
        })
        .then((products) =>
          products.sort((a, b) => naturalCompare(a.number, b.number)),
        ),
      prisma.defaultPrice.findMany({
        select: { type: true, groupId: true, price: true },
      }),
    ]);

    const availableProducts = allProducts
      .map((product) => {
        try {
          const price = resolveItemPrice(
            product,
            order.partner.prices,
            customPrices,
            defaultPrices,
          );
          return { ...product, price };
        } catch {
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return Response.json({
      order: toPlain(order),
      editable: reason === null,
      reason,
      availableProducts: toPlain(availableProducts),
    });
  } catch (error) {
    console.error('Error loading order for edit:', error);
    return new Response('Failed to load order', { status: 500 });
  }
}

interface EditItemInput {
  productId: number;
  quantity: number;
}

interface EditOrderBody {
  items?: EditItemInput[];
  // Поля ниже переносят заказ на владельца/тип/условия - их может менять
  // только не-владелец (супер-админ), т.к. checkEditPermission пускает
  // сюда только владельца-партнёра или SUPER_ADMIN. Владелец правит только
  // items, эти поля от него игнорируются, даже если он их пришлёт.
  partnerId?: number;
  orderType?: 'regular' | 'realization';
  hasVat?: boolean;
  notes?: string;
  address?: string;
  createdAt?: string;
}

// === PATCH: применить изменения к заказу. Владелец-партнёр может менять
// только позиции; не-владелец (супер-админ) - ещё и партнёра, тип заказа,
// НДС, примечание, адрес и дату - тот же набор полей, что и при создании
// заказа в админке ===
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const caller = await getPartnerFromSessionCookie();
    if (!caller) return new Response('Unauthorized', { status: 401 });

    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return new Response('Invalid order id', { status: 400 });
    }

    const body = (await req.json()) as EditOrderBody;
    const rawItems = body.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return new Response('Заказ не может быть пустым', { status: 400 });
    }

    let isOwnerEdit = false;
    const editorName = caller.name;
    let notifyPartnerName = '';

    const changeSummary = await prisma.$transaction(async (trx) => {
      const order = await trx.order.findUnique({
        where: { id: orderId },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
              prices: { select: { type: true, groupId: true, price: true } },
            },
          },
          items: { include: { product: true } },
        },
      });

      if (!order) {
        throw new Error('__NOT_FOUND__');
      }

      const { allowed, isOwner } = checkEditPermission(caller, order);
      if (!allowed) {
        throw new Error('__FORBIDDEN__');
      }

      const blockReason = getEditBlockReason(order, isOwner);
      if (blockReason) {
        throw new Error(blockReason);
      }

      isOwnerEdit = isOwner;
      notifyPartnerName = order.partner.name;

      // "Полное" редактирование (партнёр/тип/НДС/примечание/адрес/дата) -
      // только для не-владельца. Заказ на реализацию сюда попасть не может:
      // getEditBlockReason уже блокирует любое редактирование таких заказов,
      // так что order.isRealization здесь гарантированно false.
      let effectivePartnerId = order.partnerId;
      let effectivePartnerName = order.partner.name;
      let effectivePartnerPrices = order.partner.prices;
      let effectiveOrderType: 'regular' | 'realization' = 'regular';
      let effectiveHasVat = order.hasVat;
      let effectiveNotes = order.notes;
      let effectiveAddress = order.address;
      let effectiveCreatedAt: Date = order.createdAt;

      if (!isOwner) {
        const requestedPartnerId = body.partnerId
          ? Number(body.partnerId)
          : order.partnerId;

        if (requestedPartnerId !== order.partnerId) {
          const targetPartner = await trx.partner.findUnique({
            where: { id: requestedPartnerId },
            select: {
              id: true,
              name: true,
              role: true,
              prices: { select: { type: true, groupId: true, price: true } },
            },
          });

          if (!targetPartner || targetPartner.role !== 'PARTNER') {
            throw new Error('Партнёр не найден');
          }

          effectivePartnerId = targetPartner.id;
          effectivePartnerName = targetPartner.name;
          effectivePartnerPrices = targetPartner.prices;
        }

        effectiveOrderType =
          body.orderType === 'realization' ? 'realization' : 'regular';
        // НДС применим только к обычным заказам - как и при создании заказа
        effectiveHasVat = effectiveOrderType === 'regular' && body.hasVat === true;
        effectiveNotes = body.notes?.trim() || null;
        effectiveAddress = body.address?.trim() || null;
        effectiveCreatedAt = buildCreatedAt(body.createdAt) ?? order.createdAt;
      }

      const becomingRealization = effectiveOrderType === 'realization';

      const productIds = rawItems.map((i) => Number(i.productId));
      if (new Set(productIds).size !== productIds.length) {
        throw new Error('Товар не может повторяться в списке позиций');
      }

      const [products, defaultPrices] = await Promise.all([
        trx.product.findMany({
          where: { id: { in: productIds } },
          include: { group: true },
        }),
        trx.defaultPrice.findMany({
          select: { type: true, groupId: true, price: true },
        }),
      ]);
      const productMap = new Map(products.map((p) => [p.id, p]));

      const oldItemsByProductId = new Map(
        order.items.map((item) => [item.productId, item]),
      );
      const customPrices =
        (order.customPrices as Record<string, unknown> | null) || {};

      const newLines = rawItems.map((raw) => {
        const productId = Number(raw.productId);
        const quantity = Math.max(1, Math.floor(Number(raw.quantity)));
        const product = productMap.get(productId);

        if (!product) {
          throw new Error(`Товар с id ${productId} не найден`);
        }

        const existing = oldItemsByProductId.get(productId);
        // Владелец меняет только количество - цена позиции сохраняется как
        // была. Не-владелец может сменить партнёра/тип, поэтому цену всегда
        // пересчитывает заново (с учётом кастомных цен заказа), как и при
        // создании заказа - иначе цена могла бы остаться от старого партнёра.
        const pricePerItem =
          isOwner && existing
            ? Number(existing.pricePerItem)
            : resolveItemPrice(
                product,
                effectivePartnerPrices,
                customPrices,
                defaultPrices,
              );

        const sum = pricePerItem * quantity;

        return {
          productId,
          quantity,
          pricePerItem,
          sum,
          vatAmount: calculateVatAmount(sum, effectiveHasVat),
          number: product.number,
        };
      });

      const newProductIds = new Set(newLines.map((l) => l.productId));

      const added = newLines
        .filter((l) => !oldItemsByProductId.has(l.productId))
        .map((l) => ({
          productId: l.productId,
          number: l.number,
          quantity: l.quantity,
        }));

      const removed = order.items
        .filter((item) => !newProductIds.has(item.productId))
        .map((item) => ({
          productId: item.productId,
          number: item.product.number,
          quantity: item.quantity,
        }));

      const changed = newLines
        .filter((l) => {
          const existing = oldItemsByProductId.get(l.productId);
          return existing && existing.quantity !== l.quantity;
        })
        .map((l) => {
          const existing = oldItemsByProductId.get(l.productId)!;
          return {
            productId: l.productId,
            number: l.number,
            from: existing.quantity,
            to: l.quantity,
          };
        });

      // Что ещё поменялось помимо позиций - только для не-владельца, только
      // то, что реально отличается от текущих значений заказа.
      const extraSummaryParts: string[] = [];
      if (!isOwner) {
        if (effectivePartnerId !== order.partnerId) {
          extraSummaryParts.push(
            `партнёр изменён: ${order.partner.name} → ${effectivePartnerName}`,
          );
        }
        if (becomingRealization) {
          extraSummaryParts.push('тип изменён на "на реализацию"');
        }
        if (effectiveHasVat !== order.hasVat) {
          extraSummaryParts.push(effectiveHasVat ? 'включён НДС' : 'выключен НДС');
        }
        if ((effectiveNotes || '') !== (order.notes || '')) {
          extraSummaryParts.push('изменено примечание');
        }
        if ((effectiveAddress || '') !== (order.address || '')) {
          extraSummaryParts.push('изменён адрес доставки');
        }
        if (effectiveCreatedAt.getTime() !== order.createdAt.getTime()) {
          extraSummaryParts.push('изменена дата заказа');
        }
      }

      if (
        added.length === 0 &&
        removed.length === 0 &&
        changed.length === 0 &&
        extraSummaryParts.length === 0
      ) {
        throw new Error('Нет изменений для сохранения');
      }

      const baseTotal = newLines.reduce((s, l) => s + l.sum, 0);
      const vatTotal = newLines.reduce((s, l) => s + l.vatAmount, 0);

      await trx.orderItem.deleteMany({ where: { orderId } });
      await trx.order.update({
        where: { id: orderId },
        data: {
          totalPrice: baseTotal + vatTotal,
          vatAmount: vatTotal,
          ...(!isOwner && {
            partnerId: effectivePartnerId,
            isRealization: becomingRealization,
            hasVat: effectiveHasVat,
            notes: effectiveNotes,
            address: effectiveAddress,
            createdAt: effectiveCreatedAt,
          }),
          items: {
            create: newLines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              pricePerItem: l.pricePerItem,
              sum: l.sum,
              vatAmount: l.vatAmount,
            })),
          },
        },
      });

      // Заказ только что стал заказом на реализацию: если он уже подтверждён,
      // заводим Realization сразу (как при создании); если ещё NEW - её
      // создаст переход в CONFIRMED, см. PUT /api/admin/orders.
      if (becomingRealization && order.status === 'CONFIRMED') {
        await applyRealizationConfirmSideEffect(
          trx,
          {
            id: orderId,
            partnerId: effectivePartnerId,
            totalPrice: baseTotal + vatTotal,
            items: newLines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              pricePerItem: l.pricePerItem,
              sum: l.sum,
              product: { group: productMap.get(l.productId)?.group ?? null },
            })),
          },
          null,
        );
      }

      const summaryParts: string[] = [];
      if (added.length) {
        summaryParts.push(
          `добавлено: ${added.map((a) => `${a.number} ×${a.quantity}`).join(', ')}`,
        );
      }
      if (removed.length) {
        summaryParts.push(
          `удалено: ${removed.map((r) => `${r.number} ×${r.quantity}`).join(', ')}`,
        );
      }
      if (changed.length) {
        summaryParts.push(
          `изменено количество: ${changed
            .map((c) => `${c.number} ${c.from}→${c.to}`)
            .join(', ')}`,
        );
      }
      const summary = [...summaryParts, ...extraSummaryParts].join('; ');

      await trx.orderChangeLog.create({
        data: {
          orderId,
          changedById: caller.id,
          summary,
          details: { added, removed, changed },
        },
      });

      return summary;
    });

    // Уведомляем админов на email, только если правку внёс сам партнёр -
    // если правил админ, уведомление не нужно (он и так в курсе)
    if (isOwnerEdit) {
      try {
        const admins = await prisma.partner.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, email: { not: null } },
          select: { email: true },
        });

        await Promise.all(
          admins
            .filter((a) => a.email)
            .map((a) =>
              sendEmail({
                to: a.email as string,
                subject: `Изменения в заказе №${orderId} от ${notifyPartnerName}`,
                html: `<p>Партнёр <b>${notifyPartnerName}</b> изменил заказ №${orderId}:</p><p>${changeSummary}</p>`,
                text: `Партнёр ${notifyPartnerName} изменил заказ №${orderId}: ${changeSummary}`,
              }),
            ),
        );
      } catch (emailError) {
        console.error('Failed to send order change notification email:', emailError);
      }
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: true,
        createdBy: { select: { id: true, name: true, role: true } },
        // group нужен на клиенте для проверки "цена ниже себестоимости"
        // (см. AdminOrder/AdminProduct в app/admin/types.ts) - страница
        // заказов в админке подставляет этот ответ прямо в список заказов.
        items: { include: { product: { include: { group: true } } } },
        changeLogs: {
          orderBy: { createdAt: 'desc' },
          include: { changedBy: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    return Response.json({ order: toPlain(updatedOrder), editorName });
  } catch (error) {
    const err = error as Error;
    console.error('Error editing order:', err);

    if (err.message === '__NOT_FOUND__') {
      return new Response('Order not found', { status: 404 });
    }
    if (err.message === '__FORBIDDEN__') {
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(err.message ?? 'Failed to edit order', { status: 400 });
  }
}
