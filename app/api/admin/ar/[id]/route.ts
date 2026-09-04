/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../../auth-utils';
import { AR_CONTENT_TYPES, AR_SLUG_PATTERN, slugifyAr } from '@/lib/ar/constants';
import { pickARSettings } from '@/lib/ar/payload';
import { cleanAudioTracks } from '@/lib/ar/constants';
import { cleanSocials } from '@/lib/ar/socials';

// PATCH — обновить AR-опыт (частично)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json(
      { error: 'Unauthorized - Super admin only' },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const data = await request.json();

    const existing = await prisma.aRExperience.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Опыт не найден' }, { status: 404 });
    }

    const updateData: any = { ...pickARSettings(data) };

    if (data.title !== undefined) {
      const title = String(data.title).trim();
      if (!title) {
        return NextResponse.json(
          { error: 'Название не может быть пустым' },
          { status: 400 }
        );
      }
      updateData.title = title;
    }

    if (data.slug !== undefined) {
      const slug = slugifyAr(String(data.slug));
      if (!slug || !AR_SLUG_PATTERN.test(slug)) {
        return NextResponse.json(
          { error: 'Некорректный slug' },
          { status: 400 }
        );
      }
      if (slug !== existing.slug) {
        const clash = await prisma.aRExperience.findUnique({ where: { slug } });
        if (clash) {
          return NextResponse.json(
            { error: `Slug «${slug}» уже занят` },
            { status: 409 }
          );
        }
      }
      updateData.slug = slug;
    }

    if (data.contentType !== undefined) {
      if (!AR_CONTENT_TYPES.includes(data.contentType)) {
        return NextResponse.json(
          { error: 'Некорректный тип контента' },
          { status: 400 }
        );
      }
      updateData.contentType = data.contentType;
    }

    for (const field of [
      'markerUrl',
      'mindFileUrl',
      'contentUrl',
      'posterUrl',
      'maskUrl',
      'textureUrl',
    ] as const) {
      if (data[field] !== undefined) {
        const nullable =
          field === 'posterUrl' ||
          field === 'maskUrl' ||
          field === 'textureUrl';
        updateData[field] =
          nullable && !data[field] ? null : String(data[field]);
      }
    }

    if (data.socials !== undefined) {
      updateData.socials = cleanSocials(data.socials) ?? Prisma.DbNull;
    }
    if (data.audioTracks !== undefined) {
      updateData.audioTracks = cleanAudioTracks(data.audioTracks) ?? Prisma.DbNull;
    }

    if (data.productId !== undefined) {
      updateData.productId = data.productId
        ? parseInt(String(data.productId))
        : null;
    }

    const experience = await prisma.aRExperience.update({
      where: { id },
      data: updateData,
      include: {
        product: { select: { id: true, number: true, type: true } },
      },
    });

    return NextResponse.json(experience);
  } catch (error) {
    console.error('Error updating AR experience:', error);
    return NextResponse.json(
      { error: 'Failed to update AR experience' },
      { status: 500 }
    );
  }
}

// DELETE — удалить AR-опыт. Файлы в Dropbox не трогаем (как и при удалении
// товара), чтобы случайно не потерять ассеты, переиспользуемые в другом опыте.
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json(
      { error: 'Unauthorized - Super admin only' },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    await prisma.aRExperience.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting AR experience:', error);
    return NextResponse.json(
      { error: 'Failed to delete AR experience' },
      { status: 500 }
    );
  }
}
