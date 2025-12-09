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

  // Fetch materials from database
  const materialsDb = await prisma.materialCatalog.findMany();
  const materialMap = new Map(materialsDb.map((m) => [m.name, m.id]));

  const products = [...magnets, ...plates].map((item: any) => {
    const key = `${item.type}_${item.material}`;
    const costPrice = COST_PRICES[key] || 0;
    const materialId = materialMap.get(item.material) || 1; // Default to first material if not found

    return {
      number: item.number,
      type: item.type as string,
      country: item.country.toUpperCase(),
      image: item.image.replace('public/', ''),
      materialId,
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
  const pass4 = await bcrypt.hash('test123', 10);
  const pass5 = await bcrypt.hash('password', 10);

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
    prisma.partner.create({
      data: {
        name: 'ДекорШоп',
        login: 'decorshop',
        password: pass4,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'МагаУниверсал',
        login: 'magauniversal',
        password: pass5,
        role: 'PARTNER',
      },
    }),
  ]);

  console.log(`✓ Partners created: ${partners.length}`);

  const magnets = loadJSON('magnets.json');
  const plates = loadJSON('plates.json');
  const products = [...magnets, ...plates];

  // Fetch materials from database
  const materialsDb = await prisma.materialCatalog.findMany();
  const materialMap = new Map(materialsDb.map((m) => [m.name, m.id]));

  const MATERIALS = [
    ...new Set(products.map((p: any) => p.material)),
  ] as string[];
  const TYPES = [
    ...new Set(products.map((p: any) => p.type.toUpperCase())),
  ] as string[];

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
        let price = BASE_PRICES[key];

        if (!price) {
          // Если цены нет - генерируем рандомную для демо
          price = Math.random() * 150 + 10;
        }

        const materialId = materialMap.get(material) || 1;

        pricesToInsert.push({
          partnerId: partner.id,
          type,
          materialId,
          price,
        });
      }
    }

    if (pricesToInsert.length) {
      await prisma.price.createMany({ data: pricesToInsert as any });
    }
  }

  console.log('✓ Dynamic prices seeded');
  return partners;
}

async function seedDemoOrders(
  partners: Awaited<ReturnType<typeof seedPartners>>,
  products: any[]
) {
  console.log('📦 Creating demo orders with random dates...');

  const PARTNER_IDS = partners.map((p) => p.id);

  let ordersCreated = 0;
  const orderCount = Math.floor(Math.random() * 50) + 50; // 50-100 заказов

  for (let i = 0; i < orderCount; i++) {
    const partnerId = getRandomItem(PARTNER_IDS);
    const itemsCount = Math.floor(Math.random() * 5) + 1;

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
          status: 'DONE',
          createdAt: getRandomDate(30),
          items: {
            create: items,
          },
        },
        include: { items: true },
      });

      ordersCreated++;

      // Случайно создаём реализацию для некоторых заказов (20% шанс)
      if (Math.random() < 0.2) {
        const realizationItems = order.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.pricePerItem,
          costPrice: Math.random() * 50 + 5,
          totalPrice: Number(item.sum),
        }));

        const totalCost = Number(order.totalPrice);

        const realization = await (prisma as any).realization.create({
          data: {
            orderId: order.id,
            partnerId,
            totalCost,
            paidAmount: 0,
            status: 'PENDING',
            createdAt: getRandomDate(30),
            items: {
              create: realizationItems,
            },
          },
        });

        // Случайно добавляем частичный платёж для некоторых реализаций
        if (Math.random() < 0.3) {
          const paymentAmount = (Math.random() * 0.6 + 0.2) * totalCost;

          await prisma.realizationPayment.create({
            data: {
              realizationId: realization.id,
              amount: Math.round(paymentAmount * 100) / 100,
            },
          });

          // Обновляем статус реализации
          const newPaidAmount = paymentAmount;
          const newStatus =
            newPaidAmount >= totalCost
              ? 'COMPLETED'
              : newPaidAmount > 0
              ? 'PARTIAL'
              : 'PENDING';

          await (prisma as any).realization.update({
            where: { id: realization.id },
            data: {
              paidAmount: Math.round(paymentAmount * 100) / 100,
              status: newStatus,
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
  console.log('🔄 Demo Seed - заполнение тестовыми данными...\n');

  const products = await seedProducts();
  const partners = await seedPartners();
  await seedDemoOrders(partners, products);

  console.log('\n✅ Demo seed completed! Ready to test admin panel');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
