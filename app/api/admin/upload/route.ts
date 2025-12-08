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
    if (!(await checkAdminAuth())) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const safeName = sanitizeFilename(file.name);
    const filename = `${Date.now()}_${safeName}`;

    const { url } = await uploadImage(buffer, filename);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
