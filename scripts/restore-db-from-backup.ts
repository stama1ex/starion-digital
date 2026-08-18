/* eslint-disable @typescript-eslint/no-explicit-any */
// Восстанавливает БД из zip-файла, созданного lib/backup/create-backup.ts
// (тот же формат, что грузится в Dropbox по /api/cron/backup).
//
// ⚠️ ДЕСТРУКТИВНО: полностью очищает перечисленные ниже таблицы и
// заполняет их данными из бэкапа. Использовать только в крайнем случае
// (потеря БД), не для повседневных операций.
//
// Использование:
//   1. Скачать нужный starion-backup-YYYY-MM-DD.zip из Dropbox (/backups)
//      на локальную машину.
//   2. ts-node scripts/restore-db-from-backup.ts <путь-к-zip> --yes
//      (DATABASE_URL должен указывать на БД, которую восстанавливаем)
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Порядок как при бэкапе (см. BACKUP_TABLE_ORDER в lib/backup/create-backup.ts):
// родители перед потомками. Вставка идёт в этом порядке, удаление — в обратном.
const RESTORE_TABLES = [
  { jsonKey: 'partners', model: 'partner', tableName: 'Partner' },
  {
    jsonKey: 'product_groups',
    model: 'productGroup',
    tableName: 'ProductGroup',
  },
  { jsonKey: 'products', model: 'product', tableName: 'Product' },
  {
    jsonKey: 'default_prices',
    model: 'defaultPrice',
    tableName: 'DefaultPrice',
  },
  { jsonKey: 'prices', model: 'price', tableName: 'Price' },
  { jsonKey: 'orders', model: 'order', tableName: 'Order' },
  { jsonKey: 'order_items', model: 'orderItem', tableName: 'OrderItem' },
  {
    jsonKey: 'order_change_logs',
    model: 'orderChangeLog',
    tableName: 'OrderChangeLog',
  },
  { jsonKey: 'realizations', model: 'realization', tableName: 'Realization' },
  {
    jsonKey: 'realization_items',
    model: 'realizationItem',
    tableName: 'RealizationItem',
  },
  {
    jsonKey: 'realization_payments',
    model: 'realizationPayment',
    tableName: 'RealizationPayment',
  },
  {
    jsonKey: 'partnership_requests',
    model: 'partnershipRequest',
    tableName: 'PartnershipRequest',
  },
] as const;

async function main() {
  const zipPath = process.argv[2];
  const confirmed = process.argv.includes('--yes');

  if (!zipPath) {
    console.error(
      'Usage: ts-node scripts/restore-db-from-backup.ts <path-to-backup.zip> --yes',
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(zipPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  if (!confirmed) {
    console.error(
      '⚠️  This DELETES all current rows in every backed-up table and replaces\n' +
        '   them with the contents of the archive. This cannot be undone.\n' +
        '   Re-run with --yes once you are sure.',
    );
    process.exit(1);
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(resolvedPath));

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    console.error(
      '❌ manifest.json not found in archive — is this a valid backup file?',
    );
    process.exit(1);
  }
  const manifest = JSON.parse(await manifestFile.async('string'));
  console.log(`📦 Restoring backup created at ${manifest.createdAt}`);

  const data: Record<string, any[]> = {};
  for (const table of RESTORE_TABLES) {
    const file = zip.file(`${table.jsonKey}.json`);
    if (!file) {
      console.error(`❌ Missing ${table.jsonKey}.json in archive`);
      process.exit(1);
    }
    data[table.jsonKey] = JSON.parse(await file.async('string'));
  }

  console.log('🗑️  Wiping current data and inserting backup rows...');

  await prisma.$transaction(
    async (trx) => {
      for (const table of [...RESTORE_TABLES].reverse()) {
        await trx.$executeRawUnsafe(`DELETE FROM "${table.tableName}"`);
      }

      for (const table of RESTORE_TABLES) {
        const rows = data[table.jsonKey];
        if (rows.length > 0) {
          await (trx as any)[table.model].createMany({ data: rows });
        }

        // createMany вставляет явные id из бэкапа, но не двигает
        // SERIAL-последовательность — без этого следующий INSERT без id
        // столкнётся с уже занятым значением
        await trx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table.tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table.tableName}"), 1), true)`,
        );

        console.log(`  ✅ ${table.jsonKey}: ${rows.length} rows`);
      }
    },
    { timeout: 5 * 60 * 1000 },
  );

  console.log('✨ Restore complete.');
}

main()
  .catch((error) => {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
