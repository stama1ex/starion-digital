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

  const products = [...magnets, ...plates].map((item: any) => {
    const prefix = item.type === 'magnet' ? 'M' : 'T';

    return {
      number: `${prefix}${item.number}`,
      type: item.type === 'magnet' ? ProductType.MAGNET : ProductType.PLATE,
      country: item.country.toUpperCase(),
      image: item.image.replace('public/', ''),
      material: Material.MARBLE,
    };
  });

  // Чистим продукты и связанные с ними OrderItem
  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`Products inserted: ${products.length}`);
}

async function seedPartners() {
  // Удаляем партнёров и их связи
  await prisma.order.deleteMany();
  await prisma.price.deleteMany();
  await prisma.partner.deleteMany();

  // Создаём партнёров
  const partners = await prisma.$transaction([
    prisma.partner.create({
      data: {
        name: 'MagnetPlus SRL',
        login: 'magnetplus',
        password: '12345', // временно без хэша
      },
    }),
    prisma.partner.create({
      data: {
        name: 'ArtDecor SRL',
        login: 'artdecor',
        password: 'qwerty',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'CasaSuvenir',
        login: 'casasuvenir',
        password: '11111',
      },
    }),
  ]);

  console.log('Partners created:', partners.map((p) => p.login).join(', '));

  // Цены (MARBLE - единственный материал на данный момент)
  const MARBLE_PRICES = [
    //     MAGNET  PLATE
    { login: 'magnetplus', magnet: 12, plate: 35 },
    { login: 'artdecor', magnet: 15, plate: 30 },
    { login: 'casasuvenir', magnet: 10, plate: 40 },
  ];

  // Привязка цен к каждому партнёру
  for (const entry of MARBLE_PRICES) {
    const partner = partners.find((p) => p.login === entry.login);
    if (!partner) continue;

    await prisma.price.createMany({
      data: [
        {
          partnerId: partner.id,
          type: ProductType.MAGNET,
          material: Material.MARBLE,
          price: entry.magnet,
        },
        {
          partnerId: partner.id,
          type: ProductType.PLATE,
          material: Material.MARBLE,
          price: entry.plate,
        },
      ],
    });
  }

  console.log('Prices seeded successfully');
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
