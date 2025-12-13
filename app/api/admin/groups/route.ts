/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminAuth } from '../auth-utils';

// GET - получить все группы или группы по типу
export async function GET(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const groups = await prisma.productGroup.findMany({
      where: type ? { type: type as any } : undefined,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { slug: 'asc' },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}

// POST - создать новую группу
export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, type, translations } = await req.json();

    if (!slug || !type || !translations) {
      return NextResponse.json(
        { error: 'Slug, type, and translations are required' },
        { status: 400 }
      );
    }

    const group = await prisma.productGroup.create({
      data: {
        slug,
        type,
        translations,
      },
    });

    return NextResponse.json(group);
  } catch (error: any) {
    console.error('Error creating group:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Group with this name already exists for this type' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}

// PUT - обновить группу
export async function PUT(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, slug, translations } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (slug !== undefined) updateData.slug = slug;
    if (translations !== undefined) updateData.translations = translations;

    const group = await prisma.productGroup.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(group);
  } catch (error: any) {
    console.error('Error updating group:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Group with this name already exists for this type' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update group' },
      { status: 500 }
    );
  }
}

// DELETE - удалить группу
export async function DELETE(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      );
    }

    await prisma.productGroup.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json(
      { error: 'Failed to delete group' },
      { status: 500 }
    );
  }
}
