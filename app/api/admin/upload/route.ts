import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/dropbox';
import { checkAdminAuth } from '../auth-utils';

function sanitizeFilename(name: string) {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '') || `file_${Date.now()}`
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log('[UPLOAD] Starting upload request');

    if (!(await checkAdminAuth())) {
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

    console.log('[UPLOAD] File received:', file.name, file.size, 'bytes');
    const buffer = await file.arrayBuffer();
    const safeName = sanitizeFilename(file.name);
    const filename = `${Date.now()}_${safeName}`;

    console.log('[UPLOAD] Sanitized filename:', filename);
    console.log('[UPLOAD] Uploading to Dropbox...');

    const { url } = await uploadImage(buffer, filename);

    console.log('[UPLOAD] Upload successful, URL:', url);
    return NextResponse.json({ success: true, url });
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
