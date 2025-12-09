/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function loadJSON(file: string) {
  const p = path.join(process.cwd(), 'public', file);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function getRandomDate(daysBack: number = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.random() * daysBack);
  return date;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedMaterials() {
  console.log('📦 Creating materials...');

  const materials = await prisma.materialCatalog.createMany({
    data: [
      { name: 'MARBLE', label: 'Мрамор' },
      { name: 'WOOD', label: 'Дерево' },
    ],
    skipDuplicates: true,
  });

  console.log(`✓ Materials created: ${materials.count || 2}`);
}

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

  // Получаем ID материалов из БД
  const materials = await prisma.materialCatalog.findMany();
  const materialMap: Record<string, number> = {};
  materials.forEach((m) => {
    materialMap[m.name] = m.id;
  });

  const products = [...magnets, ...plates].map((item: any) => {
    const key = `${item.type}_${item.material}`;
    const costPrice = COST_PRICES[key] || 0;
    const materialId = materialMap[item.material];

    return {
      number: item.number,
      type: item.type as string,
      country: item.country.toUpperCase(),
      image: item.image.replace('public/', ''),
      materialId, // Используем ID материала вместо enum
      costPrice,
    };
  });

  // Удаляем в правильном порядке (с учётом foreign keys)
  await prisma.realizationPayment.deleteMany();
  await prisma.realizationItem.deleteMany();
  await prisma.realization.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products as any });

  console.log(`✓ Products inserted: ${products.length}`);
  return products;
}

async function seedPartners() {
  await prisma.order.deleteMany();
  await prisma.realization.deleteMany();
  await prisma.realizationPayment.deleteMany();
  await prisma.price.deleteMany();
  await prisma.partner.deleteMany();

  // Хешируем пароли
  const adminPass = await bcrypt.hash('stamat2000', 10);
  const pass1 = await bcrypt.hash('12345', 10);
  const pass2 = await bcrypt.hash('qwerty', 10);
  const pass3 = await bcrypt.hash('11111', 10);

  const partners = await prisma.$transaction([
    prisma.partner.create({
      data: {
        name: 'ADMIN',
        login: 'yurix13',
        password: adminPass,
        role: 'ADMIN',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'MagnetPlus SRL',
        login: 'magnetplus',
        password: pass1,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'ArtDecor SRL',
        login: 'artdecor',
        password: pass2,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'CasaSuvenir',
        login: 'casasuvenir',
        password: pass3,
        role: 'PARTNER',
      },
    }),
  ]);

  console.log('Partners created');

  // ====== Получаем все материалы из БД ======
  const materials = await prisma.materialCatalog.findMany();

  // ====== Динамически собираем типы из JSON ======
  const magnets = loadJSON('magnets.json');
  const plates = loadJSON('plates.json');
  const products = [...magnets, ...plates];

  const TYPES = [
    ...new Set(products.map((p: any) => p.type.toUpperCase())),
  ] as string[];

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
      for (const material of materials) {
        const key = `${type}_${material.name}`;
        const price = BASE_PRICES[key];

        if (!price) continue; // Если цена не прописана вручную — не создаём

        pricesToInsert.push({
          partnerId: partner.id,
          type,
          materialId: material.id,
          price,
        });
      }
    }

    if (pricesToInsert.length) {
      await prisma.price.createMany({ data: pricesToInsert as any });
    }
  }

  console.log('Dynamic prices seeded successfully');
  return partners;
}

async function seedDemoOrders(
  partners: Awaited<ReturnType<typeof seedPartners>>,
  products: any[]
) {
  console.log('📦 Creating demo orders with random dates...');

  const PARTNER_IDS = partners
    .filter((p) => p.role === 'PARTNER')
    .map((p) => p.id);

  let ordersCreated = 0;
  const orderCount = Math.floor(Math.random() * 50) + 50; // 50-100 заказов

  const statuses = ['NEW', 'CONFIRMED', 'PAID', 'CANCELLED'];

  for (let i = 0; i < orderCount; i++) {
    const partnerId = getRandomItem(PARTNER_IDS);
    const itemsCount = Math.floor(Math.random() * 5) + 1;
    const isRealization = Math.random() < 0.3; // 30% шанс заказа на реализацию
    const status = isRealization
      ? getRandomItem(['NEW', 'CONFIRMED', 'PAID', 'CANCELLED'])
      : getRandomItem(statuses);

    const items: any[] = [];
    let totalPrice = 0;

    for (let j = 0; j < itemsCount; j++) {
      const product = getRandomItem(products);
      const quantity = Math.floor(Math.random() * 20) + 1;
      const pricePerItem = Math.random() * 100 + 20;
      const sum = quantity * pricePerItem;

      items.push({
        productId: product.id,
        quantity,
        pricePerItem: Math.round(pricePerItem * 100) / 100,
        sum: Math.round(sum * 100) / 100,
      });

      totalPrice += sum;
    }

    try {
      const order = await (prisma as any).order.create({
        data: {
          partnerId,
          totalPrice: Math.round(totalPrice * 100) / 100,
          status,
          isRealization,
          createdAt: getRandomDate(30),
          items: {
            create: items,
          },
        },
        include: { items: true },
      });

      ordersCreated++;

      // Создаём реализацию только если это заказ на реализацию и статус CONFIRMED или PAID
      if (isRealization && (status === 'CONFIRMED' || status === 'PAID')) {
        const realizationItems = order.items.map((item: any) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.pricePerItem,
            costPrice: product?.costPrice || Math.random() * 50 + 5,
            totalPrice: Number(item.sum),
          };
        });

        const totalCost = Number(order.totalPrice);
        const shouldAddPayment = Math.random() < 0.4; // 40% шанс добавления платежа
        const paymentAmount = shouldAddPayment
          ? (Math.random() * 0.8 + 0.2) * totalCost
          : 0;

        const realizationStatus =
          status === 'PAID'
            ? 'COMPLETED'
            : paymentAmount >= totalCost
            ? 'COMPLETED'
            : paymentAmount > 0
            ? 'PARTIAL'
            : 'PENDING';

        const realization = await prisma.realization.create({
          data: {
            orderId: order.id,
            partnerId,
            totalCost,
            paidAmount: Math.round(paymentAmount * 100) / 100,
            status: realizationStatus,
            createdAt: getRandomDate(30),
            items: {
              create: realizationItems,
            },
          },
        });

        // Добавляем платёж если есть
        if (shouldAddPayment && paymentAmount > 0) {
          await prisma.realizationPayment.create({
            data: {
              realizationId: realization.id,
              amount: Math.round(paymentAmount * 100) / 100,
            },
          });
        }
      }
    } catch (e) {
      console.error(`Error creating order ${i}:`, e);
    }
  }

  console.log(`✓ Demo orders created: ${ordersCreated}`);
}

async function main() {
  // Проверяем переменную окружения или аргумент командной строки
  const SEED_MODE = process.env.SEED_MODE || process.argv[2] || 'production';

  console.log(`🔄 Running seed in ${SEED_MODE.toUpperCase()} mode...\n`);

  await seedMaterials();
  await seedProducts();

  if (SEED_MODE === 'demo') {
    const partners = await seedPartners();
    const products = await prisma.product.findMany();
    await seedDemoOrders(partners, products);
    console.log('\n✅ Demo seed completed! Admin panel is ready for testing');
  } else {
    console.log('\n✅ Production seed completed! Ready for deployment');
    console.log(
      '   💡 To test with demo data, run: SEED_MODE=demo npm run seed'
    );
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
