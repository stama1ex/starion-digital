/* eslint-disable @typescript-eslint/no-explicit-any */
import { PRODUCT_TYPE_LABELS } from './constants';
import { formatMDL } from '@/lib/format-money';

/**
 * Helper functions for admin panel
 */

export function getProductTypeLabel(type: string): string {
  return PRODUCT_TYPE_LABELS[type] || type;
}

export const formatPrice = formatMDL;

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];

  const day = d.getDate();
  const month = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month}, ${hours}:${minutes}`;
}

export function filterBySearchQuery<T extends Record<string, any>>(
  items: T[],
  query: string,
  fields: (keyof T)[]
): T[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(lowerQuery);
    })
  );
}

// Тестовые партнёры (имя содержит "test"/"тест" в любом регистре, включая
// варианты вроде "Тестовый", "testing" и т.п.) — их заказы не должны
// искажать аналитику и учёт, но сами заказы остаются видны в списке заказов.
export function isTestPartnerName(name: string): boolean {
  return /test|тест/i.test(name);
}

export function groupBy<T>(
  array: T[],
  keyGetter: (item: T) => string | number
): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = String(keyGetter(item));
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function handleApiError(error: unknown): Promise<string> {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return String((error as any).error);
  }
  return 'Неизвестная ошибка';
}
