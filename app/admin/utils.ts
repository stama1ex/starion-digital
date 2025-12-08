/* eslint-disable @typescript-eslint/no-explicit-any */
export function getDateRangeFilter(dateRange: 'day' | 'week' | 'month'): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const start = new Date();

  switch (dateRange) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end: now };
}

export function filterByDateRange(
  items: { createdAt: Date }[],
  dateRange: 'day' | 'week' | 'month'
) {
  const { start, end } = getDateRangeFilter(dateRange);
  return items.filter(
    (item) => item.createdAt >= start && item.createdAt <= end
  );
}

export function calculateMetrics(
  orders: any[],
  costPriceMap: Map<number, number>
) {
  let totalRevenue = 0;
  let totalCost = 0;

  orders.forEach((order) => {
    totalRevenue += Number(order.totalPrice);
    order.items.forEach((item: any) => {
      const costPerUnit = costPriceMap.get(item.productId) || 0;
      totalCost += costPerUnit * item.quantity;
    });
  });

  return {
    totalRevenue,
    totalCost,
    grossProfit: totalRevenue - totalCost,
  };
}
