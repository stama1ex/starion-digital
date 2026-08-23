import { NextRequest, NextResponse } from 'next/server';
import { checkSuperAdminAuth } from '../../admin/auth-utils';
import { createBackupZip } from '@/lib/backup/create-backup';
import {
  uploadToDropboxPath,
  listDropboxFolder,
  deleteDropboxFile,
} from '@/lib/dropbox';

const BACKUP_FOLDER = '/backups';
const BACKUP_FILENAME = 'starion-backup.zip';
// Держим только последнюю копию - глубокая история бэкапов не нужна.
// Retention-очистка ниже удаляет всё, кроме только что загруженного файла
// (в т.ч. подчищает старые датированные файлы от предыдущей схемы имён).
const RETENTION_COUNT = 1;

// Разрешаем запуск двум способам:
// 1) Vercel Cron — шлёт заголовок Authorization: Bearer <CRON_SECRET>
//    (см. vercel.json + переменная окружения CRON_SECRET)
// 2) Вручную из админки кнопкой "Бэкап сейчас" — обычная сессия супер-админа
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return true;
  }
  return checkSuperAdminAuth();
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { buffer, manifest } = await createBackupZip();

    const path = `${BACKUP_FOLDER}/${BACKUP_FILENAME}`;

    // overwrite: фиксированное имя файла - каждый запуск просто заменяет
    // предыдущую копию
    await uploadToDropboxPath(buffer, path, 'overwrite');

    const existing = await listDropboxFolder(BACKUP_FOLDER);
    const sorted = [...existing].sort((a, b) =>
      b.serverModified.localeCompare(a.serverModified),
    );
    const toDelete = sorted.slice(RETENTION_COUNT);
    await Promise.all(toDelete.map((file) => deleteDropboxFile(file.path)));

    return NextResponse.json({
      ok: true,
      path,
      manifest,
      deletedOldBackups: toDelete.length,
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json(
      { error: 'Backup failed', details: String(error) },
      { status: 500 },
    );
  }
}
