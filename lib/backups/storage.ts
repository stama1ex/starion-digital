// Хранилище резервных копий базы.
//
// Отдельный бакет и отдельные ключи — намеренно. Публичный бакет раздаётся
// целиком через cdn.ar3d.io, поэтому дамп базы, положенный туда, был бы
// доступен любому по прямой ссылке. Бакет бэкапов закрыт, а его ключи не
// пересекаются с теми, которыми работают загрузки из админки: даже если те
// утекут, до копий базы ими не добраться.
//
// Пока переменные R2_BACKUP_* не заданы, бэкапы продолжают уходить в Dropbox
// (см. app/api/cron/backup) — переключение происходит само, как только ключи
// появятся в окружении.
import {
  deleteObject,
  isTargetConfigured,
  listObjects,
  putObject,
  type R2Object,
  type R2Target,
} from '@/lib/r2';

export const BACKUPS_DIR = 'backups';

const target: R2Target = {
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKey: process.env.R2_BACKUP_ACCESS_KEY_ID || '',
  secretKey: process.env.R2_BACKUP_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BACKUP_BUCKET || '',
};

export function backupsInR2(): boolean {
  return isTargetConfigured(target);
}

export async function putBackup(
  key: string,
  body: Buffer
): Promise<void> {
  await putObject(key, body, 'application/zip', target);
}

export async function listBackups(): Promise<R2Object[]> {
  return listObjects(`${BACKUPS_DIR}/`, target);
}

export async function deleteBackup(key: string): Promise<void> {
  await deleteObject(key, target);
}
