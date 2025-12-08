/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function loadJSON(file: string) {
  const p = path.join(process.cwd(), 'public', file);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/**
 * Production seed - только товары, без партнёров и цен
 * Используется для подготовки к продакшену
 */
async function seedProducts() {
  const magnets = loadJSON('magnets.json');
  const plates = loadJSON('plates.json');

  // Карта себестоимостей по типу и материалу (в лей)
  const COST_PRICES: Record<string, number> = {
    MAGNET_MARBLE: 7,
    MAGNET_WOOD: 5.6,
    PLATE_MARBLE: 40,
    PLATE_WOOD: 46,
  };

  const products = [...magnets, ...plates].map((item: any) => {
    const key = `${item.type}_${item.material}`;
    const costPrice = COST_PRICES[key] || 0;

    return {
      number: item.number,
      type: item.type as string,
      country: item.country.toUpperCase(),
      image: item.image.replace('public/', ''),
      material: item.material as string,
      costPrice, // Себестоимость на основе типа и материала
    };
  });

  // Удаляем в правильном порядке (с учётом foreign keys)
  await prisma.realizationPayment.deleteMany();
  await prisma.realizationItem.deleteMany();
  await prisma.realization.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.price.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.product.createMany({ data: products as any });

  console.log(`✓ Products inserted: ${products.length}`);
}

async function main() {
  console.log('🔄 Production Seed - только товары...');
  await seedProducts();
  await prisma.partner.create({
    data: { name: 'ADMIN', login: 'yurix13', password: 'stamat2000' },
  });
  console.log('✅ Production seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
