import { createHash, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

const SESSION_COOKIE_NAME = 'session';
const SESSION_BIND_COOKIE_NAME = 'session_bind';
const SESSION_TTL_DAYS = 7;

type SessionRole = 'ADMIN' | 'PARTNER';

type PartnerSessionRow = {
  id: number;
  partnerId: number;
};

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getCookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  };
}

export async function createSessionCookies(
  partnerId: number,
  userAgent?: string | null,
) {
  const sessionToken = randomUUID();
  const sessionBind = randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$executeRaw`
    INSERT INTO "PartnerSession" (
      "partnerId",
      "tokenHash",
      "bindHash",
      "userAgent",
      "createdAt",
      "lastUsedAt",
      "expiresAt"
    ) VALUES (
      ${partnerId},
      ${hashValue(sessionToken)},
      ${hashValue(sessionBind)},
      ${userAgent ?? null},
      NOW(),
      NOW(),
      ${expiresAt}
    )
  `;

  return {
    sessionToken,
    sessionBind,
    expiresAt,
  };
}

export async function getPartnerFromSessionToken(
  token: string | null | undefined,
  role?: SessionRole,
  bindToken?: string | null | undefined,
) {
  if (!token || !bindToken) {
    return null;
  }

  const sessions = await prisma.$queryRaw<PartnerSessionRow[]>`
    SELECT s."id", s."partnerId"
    FROM "PartnerSession" s
    WHERE s."tokenHash" = ${hashValue(token)}
      AND s."bindHash" = ${hashValue(bindToken)}
      AND s."revokedAt" IS NULL
      AND s."expiresAt" > NOW()
    ORDER BY s."createdAt" DESC
    LIMIT 1
  `;

  const session = sessions[0];

  if (!session) {
    return null;
  }

  await prisma.$executeRaw`
    UPDATE "PartnerSession"
    SET "lastUsedAt" = NOW()
    WHERE "id" = ${session.id}
  `;

  const partner = await prisma.partner.findUnique({
    where: { id: session.partnerId },
  });

  if (!partner) {
    return null;
  }

  if (role && partner.role !== role) {
    return null;
  }

  return partner;
}

export async function revokeSessionByCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const bindToken = cookieStore.get(SESSION_BIND_COOKIE_NAME)?.value;

  if (!token || !bindToken) {
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM "PartnerSession"
    WHERE "tokenHash" = ${hashValue(token)}
      AND "bindHash" = ${hashValue(bindToken)}
  `;
}

export async function getPartnerFromSessionCookie(role?: SessionRole) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const bindToken = cookieStore.get(SESSION_BIND_COOKIE_NAME)?.value;
  return getPartnerFromSessionToken(token, role, bindToken);
}

export async function getCurrentSessionTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return hashValue(token);
}

export type PartnerSessionInfo = {
  id: number;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  tokenHash: string;
  userAgent: string | null;
};

export async function listActiveSessions(partnerId: number) {
  return prisma.$queryRaw<PartnerSessionInfo[]>`
    SELECT "id", "createdAt", "lastUsedAt", "expiresAt", "tokenHash", "userAgent"
    FROM "PartnerSession"
    WHERE "partnerId" = ${partnerId}
      AND "revokedAt" IS NULL
      AND "expiresAt" > NOW()
    ORDER BY "lastUsedAt" DESC
  `;
}

export async function revokeSessionById(partnerId: number, sessionId: number) {
  await prisma.$executeRaw`
    UPDATE "PartnerSession"
    SET "revokedAt" = NOW()
    WHERE "id" = ${sessionId} AND "partnerId" = ${partnerId}
  `;
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionBindCookieName() {
  return SESSION_BIND_COOKIE_NAME;
}

export function getSessionCookieOptions() {
  return getCookieOptions(60 * 60 * 24 * SESSION_TTL_DAYS);
}

export function getClearedSessionCookieOptions() {
  return getCookieOptions(0);
}
