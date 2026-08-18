import type {
  Order,
  OrderChangeLog,
  OrderItem,
  Partner,
  Product,
  ProductGroup,
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

// Себестоимость живёт на группе, а не на товаре - product.group нужен
// везде, где считается прибыль/маржа (см. app/admin/utils.ts,
// sales-analytics.tsx, top-products.tsx, orders-management.tsx).
export type AdminProduct = Product & {
  group: Pick<ProductGroup, 'id' | 'costPrice'> | null;
};

export type AdminOrder = Order & {
  partner: Partner;
  createdBy: Pick<Partner, 'id' | 'name' | 'role'> | null;
  changeLogs: AdminOrderChangeLog[];
  items: (OrderItem & { product: AdminProduct })[];
};

export type AdminPartner = Partner;

export type AdminRealization = Realization & {
  partner: Partner;
  items: (RealizationItem & { product: AdminProduct })[];
  payments: RealizationPayment[];
};
