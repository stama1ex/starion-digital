import { prisma } from '@/lib/db';
import { getPartnerFromSessionCookie } from '@/lib/auth/session';
import { resolveItemPrice } from '@/lib/orders/pricing';
import { sendEmail } from '@/lib/email/transport';
import { toPlain } from '@/lib/toPlain';

const EDITABLE_STATUSES = ['NEW', 'CONFIRMED'];

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

function getEditBlockReason(order: { isRealization: boolean; status: string }) {
  if (order.isRealization) {
    return 'Заказы на реализацию нельзя редактировать';
  }
  if (!EDITABLE_STATUSES.includes(order.status)) {
    return 'Редактирование доступно только для новых или подтверждённых заказов';
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

    const { allowed } = checkEditPermission(caller, order);
    if (!allowed) return new Response('Forbidden', { status: 403 });

    const reason = getEditBlockReason(order);
    const customPrices =
      (order.customPrices as Record<string, unknown> | null) || {};

    const [allProducts, defaultPrices] = await Promise.all([
      prisma.product.findMany({
        where: { isHidden: false },
        orderBy: { number: 'asc' },
      }),
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

// === PATCH: применить изменения позиций заказа ===
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

    const body = (await req.json()) as { items?: EditItemInput[] };
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

      const blockReason = getEditBlockReason(order);
      if (blockReason) {
        throw new Error(blockReason);
      }

      isOwnerEdit = isOwner;
      notifyPartnerName = order.partner.name;

      const productIds = rawItems.map((i) => Number(i.productId));
      if (new Set(productIds).size !== productIds.length) {
        throw new Error('Товар не может повторяться в списке позиций');
      }

      const [products, defaultPrices] = await Promise.all([
        trx.product.findMany({ where: { id: { in: productIds } } }),
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
        const pricePerItem = existing
          ? Number(existing.pricePerItem)
          : resolveItemPrice(
              product,
              order.partner.prices,
              customPrices,
              defaultPrices,
            );

        return {
          productId,
          quantity,
          pricePerItem,
          sum: pricePerItem * quantity,
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

      if (added.length === 0 && removed.length === 0 && changed.length === 0) {
        throw new Error('Нет изменений для сохранения');
      }

      const totalPrice = newLines.reduce((s, l) => s + l.sum, 0);

      await trx.orderItem.deleteMany({ where: { orderId } });
      await trx.order.update({
        where: { id: orderId },
        data: {
          totalPrice,
          items: {
            create: newLines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              pricePerItem: l.pricePerItem,
              sum: l.sum,
            })),
          },
        },
      });

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
      const summary = summaryParts.join('; ');

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
        items: { include: { product: true } },
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
