/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, ProductType, Material } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function loadJSON(file: string) {
  const p = path.join(process.cwd(), 'public', file);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

async function seedProducts() {
  const magnets = loadJSON('magnets.json');
  const plates = loadJSON('plates.json');

  const products = [...magnets, ...plates].map((item: any) => ({
    number: item.number,
    type: item.type as ProductType,
    country: item.country.toUpperCase(),
    image: item.image.replace('public/', ''),
    material: item.material as Material,
  }));

  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });

  console.log(`Products inserted: ${products.length}`);
}

async function seedPartners() {
  await prisma.order.deleteMany();
  await prisma.price.deleteMany();
  await prisma.partner.deleteMany();

  const partners = await prisma.$transaction([
    prisma.partner.create({
      data: { name: 'MagnetPlus SRL', login: 'magnetplus', password: '12345' },
    }),
    prisma.partner.create({
      data: { name: 'ArtDecor SRL', login: 'artdecor', password: 'qwerty' },
    }),
    prisma.partner.create({
      data: { name: 'CasaSuvenir', login: 'casasuvenir', password: '11111' },
    }),
  ]);

  console.log('Partners created');

  // ====== Важно: динамически собираем все материалы и типы из JSON ======
  const magnets = loadJSON('magnets.json');
  const plates = loadJSON('plates.json');
  const products = [...magnets, ...plates];

  const MATERIALS = [
    ...new Set(products.map((p: any) => p.material)),
  ] as Material[];
  const TYPES = [
    ...new Set(products.map((p: any) => p.type.toUpperCase())),
  ] as ProductType[];

  // ====== Базовые цены (можешь менять) ======
  const BASE_PRICES: Record<string, number> = {
    MAGNET_MARBLE: 20,
    PLATE_MARBLE: 120,
    MAGNET_WOOD: 15,
    PLATE_WOOD: 110,
  };

  for (const partner of partners) {
    const pricesToInsert = [];

    for (const type of TYPES) {
      for (const material of MATERIALS) {
        const key = `${type}_${material}`;
        const price = BASE_PRICES[key];

        if (!price) continue; // Если цена не прописана вручную — не создаём

        pricesToInsert.push({
          partnerId: partner.id,
          type,
          material,
          price,
        });
      }
    }

    if (pricesToInsert.length) {
      await prisma.price.createMany({ data: pricesToInsert });
    }
  }

  console.log('Dynamic prices seeded successfully');
}

async function main() {
  console.log('Seeding started...');
  await seedProducts();
  await seedPartners();
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
