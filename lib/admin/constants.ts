import { ProductType } from '@prisma/client';

// Order status types and labels
export type OrderStatusType = 'NEW' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

export const ORDER_STATUS_LABELS: Record<OrderStatusType, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
};

export const ORDER_STATUS_COLORS: Record<OrderStatusType, string> = {
  NEW: 'bg-yellow-500',
  CONFIRMED: 'bg-blue-500',
  PAID: 'bg-green-500',
  CANCELLED: 'bg-red-500',
};

// Product types
export const PRODUCT_TYPES: ProductType[] = [
  'MAGNET',
  'PLATE',
  //   'POSTCARD',
  //   'STATUE',
  //   'BALL',
];

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  MAGNET: 'Магнит',
  PLATE: 'Тарелка',
  POSTCARD: 'Открытка',
  STATUE: 'Статуэтка',
  BALL: 'Шар',
};

export const PRODUCT_TYPE_LABELS_PLURAL: Record<string, string> = {
  MAGNET: 'Магниты',
  PLATE: 'Тарелки',
  POSTCARD: 'Открытки',
  STATUE: 'Статуэтки',
  BALL: 'Шары',
};

// Available product types for UI
export const PRODUCT_TYPES_OPTIONS = PRODUCT_TYPES.map((type) => ({
  value: type,
  label: PRODUCT_TYPE_LABELS_PLURAL[type],
}));
