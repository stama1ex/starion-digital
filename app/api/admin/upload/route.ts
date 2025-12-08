import { NextRequest, NextResponse } from 'next/server';
import { uploadToDropbox } from '@/lib/dropbox';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const filename = `products/${Date.now()}_${file.name}`;

    const dropboxPath = await uploadToDropbox(buffer, filename);

    return NextResponse.json({
      success: true,
      path: dropboxPath,
      url: dropboxPath, // Dropbox даст прямую ссылку
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
