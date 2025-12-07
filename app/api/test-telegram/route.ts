import { sendToTelegram } from '@/lib/telegram';

export async function GET() {
  await sendToTelegram({ test: 'Server connected!' });
  return Response.json({ ok: true, sent: true });
}
