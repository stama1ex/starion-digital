import { NextRequest, NextResponse } from 'next/server';
import { checkSuperAdminAuth } from '../../auth-utils';
import { resolveARAssetUrl } from '@/lib/ar/server';
import { AR_DROPBOX_DIR } from '@/lib/ar/constants';
import { isR2Path, r2Key } from '@/lib/ar/server';

// Временная ссылка на только что загруженный AR-ассет — для предпросмотра в
// форме админки (маркер/постер). Только super-admin, только пути внутри /ar.
export async function GET(request: NextRequest) {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path') || '';

  // Проверка не даёт вытащить произвольный файл из хранилища: разрешаем только
  // каталог AR. Хранилищ два, и путь у них выглядит по-разному — Dropbox
  // отдаёт '/ar/...', R2 — 'r2:ar/...'.
  const inArDir = isR2Path(path)
    ? r2Key(path).startsWith(`${AR_DROPBOX_DIR.replace(/^\//, '')}/`)
    : path.startsWith(`${AR_DROPBOX_DIR}/`);

  if (!inArDir || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const url = await resolveARAssetUrl(path);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[AR preview] failed:', error);
    return NextResponse.json({ error: 'Preview unavailable' }, { status: 502 });
  }
}
