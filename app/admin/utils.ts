/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AdminOrder } from './types';

export type DateRange = 'day' | 'week' | 'month';

export function getDateRangeFilter(
  dateRange: DateRange,
  customRange?: { from: string; to: string }
): {
  start: Date;
  end: Date;
} {
  if (customRange) {
    return {
      start: new Date(customRange.from + 'T00:00:00'),
      end: new Date(customRange.to + 'T23:59:59'),
    };
  }

  const now = new Date();
  const start = new Date(now);

  switch (dateRange) {
    case 'day': {
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'week': {
      const day = now.getDay(); // 0 (Sun) - 6 (Sat)
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // понедельник
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month': {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    }
  }

  return { start, end: now };
}

export function filterByDateRange<T extends { createdAt: string | Date }>(
  items: T[],
  dateRange: DateRange,
  customRange?: { from: string; to: string }
): T[] {
  const { start, end } = getDateRangeFilter(dateRange, customRange);

  return items.filter((item) => {
    const date =
      item.createdAt instanceof Date
        ? item.createdAt
        : new Date(item.createdAt);
    return date >= start && date <= end;
  });
}

export function calculateMetrics(orders: AdminOrder[], realizations: any[]) {
  let totalRevenue = 0;
  let totalCost = 0;

  // Собираем ID заказов которые имеют реализацию (чтобы не считать их дважды)
  const orderIdsWithRealization = new Set(
    realizations.map((r: any) => r.orderId)
  );

  // Считаем обычные заказы полностью (только те, которые НЕ являются реализациями)
  for (const order of orders) {
    // Пропускаем заказы которые конвертированы в реализацию
    if (orderIdsWithRealization.has(order.id)) {
      continue;
    }

    totalRevenue += Number(order.totalPrice);

    for (const item of order.items) {
      const costPerUnit = Number(item.product.costPrice ?? 0);
      totalCost += costPerUnit * item.quantity;
    }
  }

  // Считаем реализации только по paidAmount
  for (const realization of realizations) {
    const paidAmount = Number(realization.paidAmount);
    if (paidAmount === 0) continue;

    totalRevenue += paidAmount;

    // Считаем себестоимость пропорционально оплаченной сумме
    const totalCostOfRealization = Number(realization.totalCost);
    const realizationRatio =
      totalCostOfRealization > 0 ? paidAmount / totalCostOfRealization : 0;

    for (const item of realization.items) {
      const costPerUnit = Number(item.costPrice ?? 0);
      totalCost += costPerUnit * item.quantity * realizationRatio;
    }
  }

  const grossProfit = totalRevenue - totalCost;

  return {
    totalRevenue,
    totalCost,
    grossProfit,
  };
}
