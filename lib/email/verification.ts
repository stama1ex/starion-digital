import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from './transport';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const CODE_TTL_MS = 10 * 60 * 1000; // код действителен 10 минут
const MAX_ATTEMPTS = 5;
const TICKET_TTL_MS = 15 * 60 * 1000; // билет подтверждения действителен 15 минут

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function getSecret(): string {
  const secret = process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET is not configured');
  }
  return secret;
}

// Подписанный билет вида payload.signature — доказательство, что email был
// подтверждён кодом, без обращения к БД на этапе финальной проверки.
function createVerificationTicket(email: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + TICKET_TTL_MS });
  const payloadBase64 = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export function verifyEmailTicket(ticket: string): string {
  const [payloadBase64, signature] = ticket.split('.');
  if (!payloadBase64 || !signature) {
    throw new Error('Invalid ticket');
  }

  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadBase64)
    .digest('base64url');

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    signatureBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    throw new Error('Invalid ticket signature');
  }

  const payload = JSON.parse(
    Buffer.from(payloadBase64, 'base64url').toString('utf8'),
  ) as { email: string; exp: number };

  if (payload.exp < Date.now()) {
    throw new Error('Ticket expired');
  }

  return payload.email;
}

export async function sendVerificationCode(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  // Предыдущие неиспользованные коды для этого email больше не нужны
  await prisma.emailVerificationCode.deleteMany({ where: { email } });
  await prisma.emailVerificationCode.create({
    data: { email, codeHash, expiresAt },
  });

  await sendEmail({
    to: email,
    subject: 'Код подтверждения — Starion Digital',
    html: `<p>Ваш код подтверждения: <b style="font-size:20px">${code}</b></p><p>Код действителен 10 минут. Если вы не запрашивали код — просто проигнорируйте это письмо.</p>`,
    text: `Ваш код подтверждения: ${code}. Код действителен 10 минут.`,
  });
}

export async function confirmVerificationCode(
  rawEmail: string,
  code: string,
): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const record = await prisma.emailVerificationCode.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.expiresAt < new Date()) {
    throw new Error('Код истёк или не найден. Запросите новый.');
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    throw new Error('Превышено число попыток. Запросите новый код.');
  }

  if (record.codeHash !== hashCode(code)) {
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error('Неверный код');
  }

  await prisma.emailVerificationCode.delete({ where: { id: record.id } });

  return createVerificationTicket(email);
}
