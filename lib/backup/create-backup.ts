import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { toPlain } from '@/lib/toPlain';

// Полный дамп бизнес-данных для резервного копирования (в отличие от
// /api/admin/export-db, который сознательно вырезает пароли и техничные
// поля для анализа) — здесь нужны ВСЕ поля, включая хэши паролей, иначе
// после восстановления партнёры не смогут зайти. Сессии и коды
// подтверждения email намеренно не бэкапятся: они короткоживущие и после
// восстановления всё равно будут недействительны.
//
// Порядок таблиц важен: сначала независимые (partners, product_groups),
// затем зависимые от них по внешним ключам. Восстановление должно вставлять
// данные в этом же порядке.
const BACKUP_TABLES = [
  ['partners', () => prisma.partner.findMany({ orderBy: { id: 'asc' } })],
  [
    'product_groups',
    () => prisma.productGroup.findMany({ orderBy: { id: 'asc' } }),
  ],
  ['products', () => prisma.product.findMany({ orderBy: { id: 'asc' } })],
  [
    'default_prices',
    () => prisma.defaultPrice.findMany({ orderBy: { id: 'asc' } }),
  ],
  ['prices', () => prisma.price.findMany({ orderBy: { id: 'asc' } })],
  ['orders', () => prisma.order.findMany({ orderBy: { id: 'asc' } })],
  ['order_items', () => prisma.orderItem.findMany({ orderBy: { id: 'asc' } })],
  [
    'order_change_logs',
    () => prisma.orderChangeLog.findMany({ orderBy: { id: 'asc' } }),
  ],
  [
    'realizations',
    () => prisma.realization.findMany({ orderBy: { id: 'asc' } }),
  ],
  [
    'realization_items',
    () => prisma.realizationItem.findMany({ orderBy: { id: 'asc' } }),
  ],
  [
    'realization_payments',
    () => prisma.realizationPayment.findMany({ orderBy: { id: 'asc' } }),
  ],
  [
    'partnership_requests',
    () => prisma.partnershipRequest.findMany({ orderBy: { id: 'asc' } }),
  ],
] as const satisfies readonly [string, () => Promise<unknown[]>][];

export const BACKUP_TABLE_ORDER = BACKUP_TABLES.map(([name]) => name);

export async function createBackupZip(): Promise<{
  buffer: Buffer;
  manifest: Record<string, number>;
}> {
  const results = await Promise.all(BACKUP_TABLES.map(([, query]) => query()));

  const zip = new JSZip();
  const manifest: Record<string, number> = {};

  BACKUP_TABLES.forEach(([name], i) => {
    const rows = toPlain(results[i]) as unknown[];
    manifest[name] = rows.length;
    zip.file(`${name}.json`, JSON.stringify(rows));
  });

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        tableOrder: BACKUP_TABLE_ORDER,
        rowCounts: manifest,
      },
      null,
      2,
    ),
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { buffer, manifest };
}
