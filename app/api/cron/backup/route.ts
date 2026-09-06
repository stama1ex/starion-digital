import { NextRequest, NextResponse } from 'next/server';
import { checkSuperAdminAuth } from '../../admin/auth-utils';
import { createBackupZip } from '@/lib/backup/create-backup';
import {
  uploadToDropboxPath,
  listDropboxFolder,
  deleteDropboxFile,
} from '@/lib/dropbox';
import {
  BACKUPS_DIR,
  backupsInR2,
  deleteBackup,
  listBackups,
  putBackup,
} from '@/lib/backups/storage';

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

    // Копии базы лежат в закрытом бакете R2, а не в публичном: тот раздаётся
    // целиком через cdn.ar3d.io. Пока ключи R2_BACKUP_* не заданы — уходит
    // в Dropbox, как раньше.
    if (backupsInR2()) {
      const key = `${BACKUPS_DIR}/${BACKUP_FILENAME}`;

      // фиксированное имя: каждый запуск просто заменяет предыдущую копию
      await putBackup(key, buffer);

      const existing = await listBackups();
      const sorted = [...existing].sort(
        (a, b) =>
          (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
      );
      const stale = sorted.slice(RETENTION_COUNT);
      await Promise.all(stale.map((file) => deleteBackup(file.key)));

      return NextResponse.json({
        ok: true,
        storage: 'r2',
        path: key,
        manifest,
        deletedOldBackups: stale.length,
      });
    }

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
      storage: 'dropbox',
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
