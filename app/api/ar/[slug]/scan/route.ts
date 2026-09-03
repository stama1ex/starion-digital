import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Инкремент счётчика сканирований. Вызывается клиентом ARViewer один раз за
// сессию (клиент сам дедуплицирует через sessionStorage), поэтому повторные
// ре-рендеры/обновления страницы не накручивают счётчик.
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  try {
    const updated = await prisma.aRExperience.update({
      where: { slug },
      data: { scanCount: { increment: 1 } },
      select: { scanCount: true },
    });
    return NextResponse.json({ ok: true, scanCount: updated.scanCount });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
