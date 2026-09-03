import { NextRequest, NextResponse } from 'next/server';
import { checkSuperAdminAuth } from '../../auth-utils';
import { createARUploadLink } from '@/lib/ar/server';
import { AR_ASSET_KINDS, AR_UPLOAD_LIMITS, type ARAssetKind } from '@/lib/ar/constants';

// Выдаёт одноразовую ссылку Dropbox для прямой загрузки AR-ассета из браузера.
// Так большие видео/GLB обходят лимит тела запроса Vercel (4.5 МБ).
export async function POST(request: NextRequest) {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json(
      { error: 'Unauthorized - Super admin only' },
      { status: 401 }
    );
  }

  try {
    const { filename, kind, size, title } = await request.json();

    if (!AR_ASSET_KINDS.includes(kind)) {
      return NextResponse.json(
        { error: 'Некорректный тип ассета' },
        { status: 400 }
      );
    }

    const limit = AR_UPLOAD_LIMITS[kind as ARAssetKind];
    if (typeof size === 'number' && size > limit.maxBytes) {
      return NextResponse.json(
        {
          error: `Файл слишком большой для «${limit.label}» (максимум ${Math.round(
            limit.maxBytes / (1024 * 1024)
          )} МБ)`,
        },
        { status: 400 }
      );
    }

    const safeName = String(filename || 'asset').slice(0, 120);
    const { uploadUrl, path } = await createARUploadLink(
      kind as ARAssetKind,
      safeName,
      typeof title === 'string' ? title : undefined
    );

    return NextResponse.json({ uploadUrl, path });
  } catch (error) {
    console.error('Error creating AR upload link:', error);
    return NextResponse.json(
      { error: 'Не удалось создать ссылку для загрузки' },
      { status: 500 }
    );
  }
}
