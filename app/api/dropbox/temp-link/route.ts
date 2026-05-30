import { NextRequest, NextResponse } from 'next/server';
import { getTemporaryLink } from '@/lib/dropbox';

function isSafeDropboxPath(inputPath: string) {
  const decoded = decodeURIComponent(inputPath);
  return decoded.startsWith('/products/') && !decoded.includes('..');
}

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    if (!isSafeDropboxPath(path)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    const url = await getTemporaryLink(path);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[TEMP LINK] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate temporary link',
      },
      { status: 500 },
    );
  }
}
