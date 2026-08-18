// Единый формат отображения сумм по всему приложению: пробел между разрядами
// тысяч/миллионов, точка перед дробной частью (1 000, 1 000 000, 99 999.99).
// Intl.NumberFormat('en-US') даёт запятую как разделитель разрядов и точку
// как десятичный разделитель - меняем запятую на пробел.
export function formatMoney(value: number | string, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const safe = Number.isFinite(num) ? num : 0;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(safe)
    .replace(/,/g, ' ');
}

export function formatMDL(value: number | string, decimals = 2): string {
  return `${formatMoney(value, decimals)} MDL`;
}
