import { NextRequest, NextResponse } from 'next/server';
import { getTemporaryLink } from '@/lib/dropbox';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const url = await getTemporaryLink(path);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[TEMP LINK] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate temporary link',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
