import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../auth-utils';
import { AR_CONTENT_TYPES, AR_SLUG_PATTERN, slugifyAr } from '@/lib/ar/constants';
import { pickARSettings } from '@/lib/ar/payload';

// GET — список всех AR-опытов (для админки)
export async function GET() {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json(
      { error: 'Unauthorized - Super admin only' },
      { status: 401 }
    );
  }

  try {
    const experiences = await prisma.aRExperience.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, number: true, type: true } },
      },
    });
    return NextResponse.json(experiences);
  } catch (error) {
    console.error('Error fetching AR experiences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AR experiences' },
      { status: 500 }
    );
  }
}

// POST — создать AR-опыт
export async function POST(request: NextRequest) {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json(
      { error: 'Unauthorized - Super admin only' },
      { status: 401 }
    );
  }

  try {
    const data = await request.json();

    const title = String(data.title ?? '').trim();
    if (!title) {
      return NextResponse.json(
        { error: 'Название обязательно' },
        { status: 400 }
      );
    }

    const slug = slugifyAr(String(data.slug || data.title || ''));
    if (!slug || !AR_SLUG_PATTERN.test(slug)) {
      return NextResponse.json(
        { error: 'Некорректный slug (только латиница, цифры и дефис)' },
        { status: 400 }
      );
    }

    if (!AR_CONTENT_TYPES.includes(data.contentType)) {
      return NextResponse.json(
        { error: 'Некорректный тип контента' },
        { status: 400 }
      );
    }

    for (const field of ['markerUrl', 'mindFileUrl', 'contentUrl'] as const) {
      if (!data[field] || !String(data[field]).trim()) {
        return NextResponse.json(
          { error: `Не загружен обязательный ассет: ${field}` },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.aRExperience.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Slug «${slug}» уже занят` },
        { status: 409 }
      );
    }

    const experience = await prisma.aRExperience.create({
      data: {
        slug,
        title,
        contentType: data.contentType,
        markerUrl: String(data.markerUrl),
        mindFileUrl: String(data.mindFileUrl),
        contentUrl: String(data.contentUrl),
        maskUrl: data.maskUrl ? String(data.maskUrl) : null,
        textureUrl: data.textureUrl ? String(data.textureUrl) : null,
        posterUrl: data.posterUrl ? String(data.posterUrl) : null,
        productId: data.productId ? parseInt(String(data.productId)) : null,
        ...pickARSettings(data),
      },
      include: {
        product: { select: { id: true, number: true, type: true } },
      },
    });

    return NextResponse.json(experience);
  } catch (error) {
    console.error('Error creating AR experience:', error);
    return NextResponse.json(
      { error: 'Failed to create AR experience' },
      { status: 500 }
    );
  }
}
