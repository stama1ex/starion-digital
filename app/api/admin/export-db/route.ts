import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { checkSuperAdminAuth } from '../auth-utils';
import { toPlain } from '@/lib/toPlain';
import { rowsToCsv } from '@/lib/export/csv';

// Полная выгрузка бизнес-данных из БД в CSV (по одному файлу на таблицу,
// заархивированы в zip) — для анализа вне админки. Технические таблицы
// (сессии, коды подтверждения email) и учётные данные (пароли, хэши)
// намеренно исключены.
export async function GET() {
  try {
    if (!(await checkSuperAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [
      partners,
      products,
      productGroups,
      defaultPrices,
      prices,
      orders,
      orderItems,
      orderChangeLogs,
      realizations,
      realizationItems,
      realizationPayments,
      partnershipRequests,
    ] = await Promise.all([
      prisma.partner.findMany({
        select: {
          id: true,
          name: true,
          login: true,
          phone: true,
          email: true,
          emailVerified: true,
          address: true,
          isVip: true,
          role: true,
          createdAt: true,
        },
        orderBy: { id: 'asc' },
      }),
      prisma.product.findMany({ orderBy: { id: 'asc' } }),
      prisma.productGroup.findMany({ orderBy: { id: 'asc' } }),
      prisma.defaultPrice.findMany({ orderBy: { id: 'asc' } }),
      prisma.price.findMany({ orderBy: { id: 'asc' } }),
      prisma.order.findMany({ orderBy: { id: 'asc' } }),
      prisma.orderItem.findMany({ orderBy: { id: 'asc' } }),
      prisma.orderChangeLog.findMany({ orderBy: { id: 'asc' } }),
      prisma.realization.findMany({ orderBy: { id: 'asc' } }),
      prisma.realizationItem.findMany({ orderBy: { id: 'asc' } }),
      prisma.realizationPayment.findMany({ orderBy: { id: 'asc' } }),
      prisma.partnershipRequest.findMany({
        select: {
          id: true,
          phone: true,
          email: true,
          address: true,
          login: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const tables: Record<string, unknown[]> = {
      partners,
      products,
      product_groups: productGroups,
      default_prices: defaultPrices,
      prices,
      orders,
      order_items: orderItems,
      order_change_logs: orderChangeLogs,
      realizations,
      realization_items: realizationItems,
      realization_payments: realizationPayments,
      partnership_requests: partnershipRequests,
    };

    const zip = new JSZip();
    for (const [name, rows] of Object.entries(tables)) {
      zip.file(
        `${name}.csv`,
        rowsToCsv(toPlain(rows) as Record<string, unknown>[]),
      );
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="starion-db-export-${date}.zip"`,
      },
    });
  } catch (error) {
    console.error('Error exporting database:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
