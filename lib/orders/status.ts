import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// Побочный эффект подтверждения заказа на реализацию (статус -> CONFIRMED):
// создаёт Realization, если её ещё нет, либо восстанавливает отменённую.
// Используется и при смене статуса одного заказа, и при массовом подтверждении.
export async function applyRealizationConfirmSideEffect(
  trx: Tx,
  order: {
    id: number;
    partnerId: number;
    totalPrice: Prisma.Decimal | number;
    items: {
      productId: number;
      quantity: number;
      pricePerItem: Prisma.Decimal | number;
      sum: Prisma.Decimal | number;
      product: { costPrice: Prisma.Decimal | number };
    }[];
  },
  existingRealization: { id: number; status: string } | null,
) {
  if (!existingRealization) {
    await trx.realization.create({
      data: {
        orderId: order.id,
        partnerId: order.partnerId,
        totalCost: order.totalPrice,
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.pricePerItem,
            costPrice: item.product.costPrice,
            totalPrice: item.sum,
          })),
        },
      },
    });
    return;
  }

  if (existingRealization.status === 'CANCELLED') {
    await trx.realization.update({
      where: { id: existingRealization.id },
      data: { status: 'PENDING' },
    });
  }
}
