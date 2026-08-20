import { ProductType } from '@prisma/client';

// Order status types and labels
export type OrderStatusType =
  | 'NEW'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'PAID'
  | 'CANCELLED';

export const ORDER_STATUS_LABELS: Record<OrderStatusType, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  SHIPPED: 'Отправлен',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
};

export const ORDER_STATUS_COLORS: Record<OrderStatusType, string> = {
  NEW: 'bg-yellow-500',
  CONFIRMED: 'bg-blue-500',
  SHIPPED: 'bg-purple-500',
  PAID: 'bg-green-500',
  CANCELLED: 'bg-red-500',
};

// Product types
export const PRODUCT_TYPES: ProductType[] = [
  'MAGNET',
  'PLATE',
  'POSTCARD',
  'KEYCHAIN',
  //   'STATUE',
  //   'BALL',
];

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  MAGNET: 'Магнит',
  PLATE: 'Тарелка',
  POSTCARD: 'Открытка',
  KEYCHAIN: 'Брелок',
  STATUE: 'Статуэтка',
  BALL: 'Шар',
};

export const PRODUCT_TYPE_LABELS_PLURAL: Record<string, string> = {
  MAGNET: 'Магниты',
  PLATE: 'Тарелки',
  POSTCARD: 'Открытки',
  KEYCHAIN: 'Брелоки',
  STATUE: 'Статуэтки',
  BALL: 'Шары',
};

// Available product types for UI
export const PRODUCT_TYPES_OPTIONS = PRODUCT_TYPES.map((type) => ({
  value: type,
  label: PRODUCT_TYPE_LABELS_PLURAL[type],
}));

// Типы (функционал) ограниченных админов - какие разделы админки им доступны.
// Новые роли с другим набором полномочий добавляются сюда одной строкой.
export const ADMIN_ROLE_OPTIONS = [
  {
    value: 'ADMIN',
    label: 'Заказы',
    description: 'Оформление и просмотр заказов, экспорт',
  },
  {
    value: 'PRODUCT_ADMIN',
    label: 'Товары',
    description: 'Управление товарами и группами',
  },
] as const;

export type AdminRoleValue = (typeof ADMIN_ROLE_OPTIONS)[number]['value'];
