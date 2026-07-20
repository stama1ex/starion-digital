import type { DefaultPrice, Price, Product } from '@prisma/client';

type CustomPrices = Record<string, unknown> | null | undefined;
type PriceRow = Pick<Price, 'type' | 'groupId' | 'price'>;
type DefaultPriceRow = Pick<DefaultPrice, 'type' | 'groupId' | 'price'>;

function customPriceKey(product: Pick<Product, 'type' | 'groupId'>) {
  return `${product.type}-${product.groupId}`;
}

// Цена за единицу товара: кастомная цена заказа (customPrices) в приоритете,
// затем стандартная цена партнёра, и в конце - цена по умолчанию для
// типа/группы (defaultPrices), чтобы можно было добавить в заказ любой товар,
// даже если партнёру никогда явно не назначали на него цену. Бросает ошибку,
// только если цена не найдена совсем нигде.
export function resolveItemPrice(
  product: Pick<Product, 'type' | 'groupId' | 'number'>,
  partnerPrices: PriceRow[],
  customPrices?: CustomPrices,
  defaultPrices?: DefaultPriceRow[],
): number {
  const key = customPriceKey(product);
  const customPrice = customPrices?.[key];

  if (customPrice !== undefined && customPrice !== null && customPrice !== '') {
    return parseFloat(String(customPrice));
  }

  const standardPrice = partnerPrices.find(
    (p) => p.type === product.type && p.groupId === product.groupId,
  );
  if (standardPrice) {
    return Number(standardPrice.price);
  }

  const defaultPrice = defaultPrices?.find(
    (p) => p.type === product.type && p.groupId === product.groupId,
  );
  if (defaultPrice) {
    return Number(defaultPrice.price);
  }

  throw new Error(
    `Не найдена цена для товара ${product.number} (${product.type}/${
      product.groupId ?? 'без группы'
    })`,
  );
}
