import type {
  Order,
  OrderChangeLog,
  OrderItem,
  Partner,
  Product,
  Realization,
  RealizationItem,
  RealizationPayment,
} from '@prisma/client';

export type AdminOrderChangeLog = Pick<
  OrderChangeLog,
  'id' | 'summary' | 'createdAt'
> & {
  changedBy: Pick<Partner, 'id' | 'name' | 'role'> | null;
};

export type AdminOrder = Order & {
  partner: Partner;
  createdBy: Pick<Partner, 'id' | 'name' | 'role'> | null;
  changeLogs: AdminOrderChangeLog[];
  items: (OrderItem & { product: Product })[];
};

export type AdminPartner = Partner;

export type AdminRealization = Realization & {
  partner: Partner;
  items: (RealizationItem & { product: Product })[];
  payments: RealizationPayment[];
};
