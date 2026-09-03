import { NextRequest, NextResponse } from 'next/server';
import { checkSuperAdminAuth } from '../../auth-utils';
import { resolveARAssetUrl } from '@/lib/ar/server';
import { AR_DROPBOX_DIR } from '@/lib/ar/constants';

// Временная ссылка на только что загруженный AR-ассет — для предпросмотра в
// форме админки (маркер/постер). Только super-admin, только пути внутри /ar.
export async function GET(request: NextRequest) {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path') || '';
  if (!path.startsWith(`${AR_DROPBOX_DIR}/`) || path.includes('..')) {
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
