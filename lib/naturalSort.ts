// Сравнивает коды товаров вроде "D1"/"D2"/"D10" по числовому значению, а не
// побайтово — иначе обычная строковая сортировка даёт D1, D10, D2, D3...
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
