import { prisma } from '@/lib/prisma';
import { checkAdminAuth } from '../auth-utils';

export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return Response.json(
        { error: 'Unauthorized - Admin only' },
        { status: 401 }
      );
    }

    const materials = await prisma.materialCatalog.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return Response.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    return Response.json(
      { error: 'Failed to fetch materials' },
      { status: 500 }
    );
  }
}
