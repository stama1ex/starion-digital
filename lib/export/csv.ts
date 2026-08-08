// UTF-8 BOM — без него Excel показывает кириллицу как "кракозябры"
const BOM = '﻿';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (/["\n\r,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// Ожидает уже "плоские" объекты (Decimal/Date переведены в число/строку,
// см. toPlain) — вложенные JSON-поля сериализуются в текст ячейки как есть.
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return BOM;

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];

  return BOM + lines.join('\r\n');
}
