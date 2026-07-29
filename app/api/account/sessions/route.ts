import { NextRequest } from 'next/server';
import {
  getCurrentSessionTokenHash,
  getPartnerFromSessionCookie,
  listActiveSessions,
  revokeSessionById,
  updateSessionLabel,
} from '@/lib/auth/session';
import { parseUserAgent } from '@/lib/auth/user-agent';

const MAX_LABEL_LENGTH = 50;

export async function GET() {
  try {
    const partner = await getPartnerFromSessionCookie();
    if (!partner) {
      return new Response('Unauthorized', { status: 401 });
    }

    const [sessions, currentTokenHash] = await Promise.all([
      listActiveSessions(partner.id),
      getCurrentSessionTokenHash(),
    ]);

    return Response.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        isCurrent: session.tokenHash === currentTokenHash,
        label: session.label,
        ...parseUserAgent(session.userAgent),
      })),
    });
  } catch (error) {
    const err = error as Error;
    console.error('List sessions error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}

// PATCH - переименовать сессию (например, "Из дома", "Из цеха"), чтобы было
// понятно, какое устройство/место ей соответствует
export async function PATCH(req: NextRequest) {
  try {
    const partner = await getPartnerFromSessionCookie();
    if (!partner) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const sessionId = Number(body?.id);
    const rawLabel = body?.label;

    if (!sessionId) {
      return new Response('Session ID is required', { status: 400 });
    }

    if (rawLabel !== null && typeof rawLabel !== 'string') {
      return new Response('Invalid label', { status: 400 });
    }

    const label = rawLabel === null ? null : rawLabel.trim() || null;
    if (label && label.length > MAX_LABEL_LENGTH) {
      return new Response(
        `Label must be at most ${MAX_LABEL_LENGTH} characters`,
        { status: 400 },
      );
    }

    const updated = await updateSessionLabel(partner.id, sessionId, label);
    if (!updated) {
      return new Response('Session not found', { status: 404 });
    }

    return Response.json({ ok: true, label });
  } catch (error) {
    const err = error as Error;
    console.error('Update session label error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const partner = await getPartnerFromSessionCookie();
    if (!partner) {
      return new Response('Unauthorized', { status: 401 });
    }

    const sessionId = Number(req.nextUrl.searchParams.get('id'));
    if (!sessionId) {
      return new Response('Session ID is required', { status: 400 });
    }

    const currentTokenHash = await getCurrentSessionTokenHash();
    const sessions = await listActiveSessions(partner.id);
    const target = sessions.find((session) => session.id === sessionId);

    if (!target) {
      return new Response('Session not found', { status: 404 });
    }

    if (target.tokenHash === currentTokenHash) {
      return new Response('Cannot revoke current session here', {
        status: 400,
      });
    }

    await revokeSessionById(partner.id, sessionId);

    return Response.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    console.error('Revoke session error:', err);
    return new Response(err.message ?? 'Error', { status: 500 });
  }
}
