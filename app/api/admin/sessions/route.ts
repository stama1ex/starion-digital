import { NextRequest } from 'next/server';
import {
  getCurrentSessionTokenHash,
  getPartnerFromSessionCookie,
  listActiveSessions,
  revokeSessionById,
} from '@/lib/auth/session';
import { parseUserAgent } from '@/lib/auth/user-agent';

async function checkAdminAuth() {
  return getPartnerFromSessionCookie('ADMIN');
}

export async function GET() {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const [sessions, currentTokenHash] = await Promise.all([
      listActiveSessions(admin.id),
      getCurrentSessionTokenHash(),
    ]);

    return Response.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        isCurrent: session.tokenHash === currentTokenHash,
        ...parseUserAgent(session.userAgent),
      })),
    });
  } catch (error) {
    const err = error as Error;
    console.error('List sessions error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return new Response('Unauthorized - Admin only', { status: 401 });
    }

    const sessionId = Number(req.nextUrl.searchParams.get('id'));
    if (!sessionId) {
      return new Response('Session ID is required', { status: 400 });
    }

    const currentTokenHash = await getCurrentSessionTokenHash();
    const sessions = await listActiveSessions(admin.id);
    const target = sessions.find((session) => session.id === sessionId);

    if (!target) {
      return new Response('Session not found', { status: 404 });
    }

    if (target.tokenHash === currentTokenHash) {
      return new Response('Cannot revoke current session here', {
        status: 400,
      });
    }

    await revokeSessionById(admin.id, sessionId);

    return Response.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    console.error('Revoke session error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}
