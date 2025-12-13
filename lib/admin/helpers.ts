/* eslint-disable @typescript-eslint/no-explicit-any */
import { PRODUCT_TYPE_LABELS } from './constants';

/**
 * Helper functions for admin panel
 */

export function getProductTypeLabel(type: string): string {
  return PRODUCT_TYPE_LABELS[type] || type;
}

export function formatPrice(price: number | string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return `${num.toFixed(2)} MDL`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
