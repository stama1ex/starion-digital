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

async function seedGroups() {
  console.log('📦 Creating groups...');

  // Удаляем старые группы
  await prisma.productGroup.deleteMany();

  const groups = await prisma.productGroup.createMany({
    data: [
      {
        slug: 'MARBLE',
        type: 'MAGNET',
        translations: {
          en: 'Marble',
          ro: 'Marmură',
          ru: 'Мраморные',
        },
      },
      {
        slug: 'WOOD',
        type: 'MAGNET',
        translations: {
          en: 'Wooden',
          ro: 'Lemn',
          ru: 'Деревянные',
        },
      },
      {
        slug: 'MARBLE',
        type: 'PLATE',
        translations: {
          en: 'Marble',
          ro: 'Marmură',
          ru: 'Мраморные',
        },
      },
      {
        slug: 'WOOD',
        type: 'PLATE',
        translations: {
          en: 'Wooden',
          ro: 'Lemn',
          ru: 'Деревянные',
        },
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✓ Groups created: ${groups.count || 4}`);
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

  // Получаем ID групп из БД
  const groups = await prisma.productGroup.findMany();
  const groupMap: Record<string, number> = {};
  groups.forEach((g) => {
    const key = `${g.type}_${g.slug}`;
    groupMap[key] = g.id;
  });

  // Маппинг материалов на группы
  const materialToGroup: Record<string, string> = {
    MARBLE: 'MARBLE',
    WOOD: 'WOOD',
  };

  const products = [...magnets, ...plates].map((item: any) => {
    const key = `${item.type}_${item.material}`;
    const costPrice = COST_PRICES[key] || 0;
    const groupName = materialToGroup[item.material];
    const groupKey = `${item.type}_${groupName}`;
    const groupId = groupMap[groupKey] || null;

    return {
      number: item.number,
      type: item.type as string,
      country: item.country.toUpperCase(),
      image: item.image.replace('public/', ''),
      groupId,
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
  const defaultPass = await bcrypt.hash('12345', 10);

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
        name: 'DPM SRL',
        login: 'DPM',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Moldpresa Grup SRL',
        login: 'Moldpresa',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Printele SRL',
        login: 'Printele',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Souvenirs FolkArt SRL',
        login: 'Souvenirs FolkArt',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Cricova-Vin SRL',
        login: 'Cricova-Vin',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"L-Consuv" SRL, Анатолий UNIC',
        login: 'L-Consuv',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Sarmax Strateg" SRL  Николай Фргеев',
        login: 'Sarmax',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"ININIH-GRUP SRL" Kolorît Комрат',
        login: 'Ininih',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Kiat" SRL, Комрат',
        login: 'Kiat',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Kolor" SRL Комрат, SMK HOME',
        login: 'Kolor',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Flor Company Комрат',
        login: 'Flor',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"CANT MASTER" SRL Комрат',
        login: 'Cantmaster',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'S.R.L. MOROI Konrad Gagauz Sofrasi',
        login: 'Moroi',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Axervat" Стройком Чадыр',
        login: 'Axervat',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Ольга Маг. Сувениров Чадыр',
        login: 'Olga-Ceadir',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Terzi Valentina" Кагул Анексей',
        login: 'Terzi',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Medicina Sigureanu" SRL "Umnago" Cadou',
        login: 'Medicina',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Ciubotaru Olesea" II, Printly Хынчешты',
        login: 'Printly',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"KSK Grup-Company" Kolorît Хынчешты',
        login: 'KSK',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Тараклия Сувенирный Магазин',
        login: 'Taraclial',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Vita Culicowschi" SRL  Кантемир Лилия',
        login: 'Vita',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"MAX Rudenko" SRL ТЦ Вулканешты',
        login: 'Max',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
  ]);

  console.log('Partners created');

  // ====== Получаем все группы из БД ======
  const groups = await prisma.productGroup.findMany();

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
    MAGNET_WOOD: 15,
    PLATE_MARBLE: 120,
    PLATE_WOOD: 110,
  };

  for (const partner of partners) {
    const pricesToInsert = [];

    for (const type of TYPES) {
      for (const group of groups) {
        if (group.type !== type) continue; // Группа должна соответствовать типу

        const key = `${type}_${group.slug}`;
        const price = BASE_PRICES[key];

        if (!price) continue; // Если цена не прописана вручную — не создаём

        pricesToInsert.push({
          partnerId: partner.id,
          type,
          groupId: group.id,
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

// Legacy function - no longer used
// async function seedAdminOnly() {
//   await prisma.price.deleteMany();
//   await prisma.partner.deleteMany();
//   const adminPass = await bcrypt.hash('stamat2000', 10);
//   const admin = await prisma.partner.create({
//     data: { name: 'ADMIN', login: 'yurix13', password: adminPass, role: 'ADMIN' },
//   });
//   console.log('✓ Admin user created');
//   return admin;
// }

async function seedProductionPartners() {
  // Удаляем старых партнеров
  await prisma.price.deleteMany();
  await prisma.partner.deleteMany();

  const adminPass = await bcrypt.hash('stamat2000', 10);
  const defaultPass = await bcrypt.hash('12345', 10);

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
        name: 'DPM SRL',
        login: 'DPM',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Moldpresa Grup SRL',
        login: 'Moldpresa',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Printele SRL',
        login: 'Printele',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Souvenirs FolkArt SRL',
        login: 'Souvenirs FolkArt',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Cricova-Vin SRL',
        login: 'Cricova-Vin',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"L-Consuv" SRL, Анатолий UNIC',
        login: 'L-Consuv',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Sarmax Strateg" SRL  Николай Фргеев',
        login: 'Sarmax',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"ININIH-GRUP SRL" Kolorît Комрат',
        login: 'Ininih',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Kiat" SRL, Комрат',
        login: 'Kiat',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Kolor" SRL Комрат, SMK HOME',
        login: 'Kolor',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Flor Company Комрат',
        login: 'Flor',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"CANT MASTER" SRL Комрат',
        login: 'Cantmaster',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'S.R.L. MOROI Konrad Gagauz Sofrasi',
        login: 'Moroi',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Axervat" Стройком Чадыр',
        login: 'Axervat',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Ольга Маг. Сувениров Чадыр',
        login: 'Olga-Ceadir',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Terzi Valentina" Кагул Анексей',
        login: 'Terzi',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Medicina Sigureanu" SRL "Umnago" Cadou',
        login: 'Medicina',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Ciubotaru Olesea" II, Printly Хынчешты',
        login: 'Printly',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"KSK Grup-Company" Kolorît Хынчешты',
        login: 'KSK',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: 'Тараклия Сувенирный Магазин',
        login: 'Taraclia',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"Vita Culicowschi" SRL  Кантемир Лилия',
        login: 'Vita',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
    prisma.partner.create({
      data: {
        name: '"MAX Rudenko" SRL ТЦ Вулканешты',
        login: 'Max',
        password: defaultPass,
        role: 'PARTNER',
      },
    }),
  ]);

  console.log('✓ Production partners created');

  // ====== Создаём базовые цены для всех партнеров ======
  const groups = await prisma.productGroup.findMany();

  const BASE_PRICES: Record<string, number> = {
    MAGNET_MARBLE: 20,
    MAGNET_WOOD: 15,
    PLATE_MARBLE: 120,
    PLATE_WOOD: 110,
  };

  for (const partner of partners) {
    if (partner.role === 'ADMIN') continue; // Пропускаем админа

    const pricesToInsert = [];

    for (const group of groups) {
      const key = `${group.type}_${group.slug}`;
      const price = BASE_PRICES[key];

      if (!price) continue;

      pricesToInsert.push({
        partnerId: partner.id,
        type: group.type,
        groupId: group.id,
        price,
      });
    }

    if (pricesToInsert.length) {
      await prisma.price.createMany({ data: pricesToInsert as any });
    }
  }

  console.log('✓ Base prices created for all partners');
  return partners;
}

async function main() {
  // Проверяем переменную окружения или аргумент командной строки
  const SEED_MODE = process.env.SEED_MODE || process.argv[2] || 'production';

  console.log(`🔄 Running seed in ${SEED_MODE.toUpperCase()} mode...\n`);

  await seedGroups();
  await seedProducts();

  if (SEED_MODE === 'demo') {
    const partners = await seedPartners();
    const products = await prisma.product.findMany();
    await seedDemoOrders(partners, products);
    console.log('\n✅ Demo seed completed! Admin panel is ready for testing');
  } else {
    await seedProductionPartners();
    console.log('\n✅ Production seed completed! Ready for deployment');
    console.log('   ✓ All partners created with base prices');
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
