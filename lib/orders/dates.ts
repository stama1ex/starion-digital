// Дата заказа из формы (либо просто "YYYY-MM-DD", либо полноценный ISO):
// если это дата без времени, подставляем текущее время, чтобы заказ
// не "прыгал" на полночь UTC при отображении.
export function buildCreatedAt(createdAt?: string) {
  if (!createdAt) {
    return undefined;
  }

  const now = new Date();
  const dateOnlyMatch = createdAt.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}
