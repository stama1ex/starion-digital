import type {
  Order,
  OrderItem,
  Partner,
  Product,
  Realization,
  RealizationItem,
  RealizationPayment,
} from '@prisma/client';

export type AdminOrder = Order & {
  partner: Partner;
  createdBy: Pick<Partner, 'id' | 'name' | 'role'> | null;
  items: (OrderItem & { product: Product })[];
};

export type AdminPartner = Partner;

export type AdminRealization = Realization & {
  partner: Partner;
  items: (RealizationItem & { product: Product })[];
  payments: RealizationPayment[];
};
