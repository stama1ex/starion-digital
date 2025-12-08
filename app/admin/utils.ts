import type { AdminOrder } from './types';

export type DateRange = 'day' | 'week' | 'month';

export function getDateRangeFilter(dateRange: DateRange): {
  start: Date;
  end: Date;
} {
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
  dateRange: DateRange
): T[] {
  const { start, end } = getDateRangeFilter(dateRange);

  return items.filter((item) => {
    const date =
      item.createdAt instanceof Date
        ? item.createdAt
        : new Date(item.createdAt);
    return date >= start && date <= end;
  });
}

export function calculateMetrics(
  orders: AdminOrder[],
  costPriceMap: Map<number, number>
) {
  let totalRevenue = 0;
  let totalCost = 0;

  for (const order of orders) {
    totalRevenue += Number(order.totalPrice);

    for (const item of order.items) {
      const costPerUnit = Number(item.product.costPrice ?? 0);
      totalCost += costPerUnit * item.quantity;
    }
  }

  const grossProfit = totalRevenue - totalCost;

  return {
    totalRevenue,
    totalCost,
    grossProfit,
  };
}
