import { NextRequest, NextResponse } from 'next/server';
import { isR2Configured, putObject, r2Path } from '@/lib/r2';
import { buildProductImageKey } from '@/lib/products/images';
import { checkProductAdminAuth } from '../auth-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('[UPLOAD] Starting upload request');

    if (!(await checkProductAdminAuth())) {
      console.log('[UPLOAD] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    console.log('[UPLOAD] Auth passed, parsing form data');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log('[UPLOAD] No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(
      '[UPLOAD] File received:',
      file.name,
      file.size,
      'bytes',
      'type:',
      file.type
    );

    // Проверка размера файла (макс 10MB)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      console.log('[UPLOAD] File too large:', file.size);
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      console.log('[UPLOAD] Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed' },
        { status: 400 }
      );
    }

    if (!isR2Configured()) {
      console.error('[UPLOAD] R2 не настроен — загружать некуда');
      return NextResponse.json(
        { error: 'Хранилище не настроено' },
        { status: 503 }
      );
    }

    const buffer = await file.arrayBuffer();
    const key = buildProductImageKey(file.name);
    console.log('[UPLOAD] Uploading to R2:', key, buffer.byteLength, 'bytes');
    await putObject(
      key,
      Buffer.from(buffer),
      file.type || 'application/octet-stream'
    );

    const path = r2Path(key);
    console.log('[UPLOAD] Upload successful, path:', path);
    return NextResponse.json({ success: true, path });
  } catch (error) {
    console.error('[UPLOAD] Error uploading file:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
