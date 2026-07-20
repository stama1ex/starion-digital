import { prisma } from '@/lib/db';

async function sendDocumentToChat(
  chatId: string,
  botToken: string,
  buffer: ArrayBuffer,
  caption?: string,
) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', new Blob([buffer]), 'order.xlsx');

  if (caption) {
    form.append('caption', caption);
  }

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    {
      method: 'POST',
      body: form,
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Failed to send Excel to Telegram chat ${chatId}:`, errorText);
  } else {
    console.log(`✅ Excel file sent to Telegram chat ${chatId}`);
  }
}

// Отправляет заказ в основной бизнес-чат (TELEGRAM_CHAT_ID) и дополнительно
// каждому ограниченному админу (role ADMIN), у которого настроен личный
// telegramChatId - так каждый такой админ получает уведомления о заказах
// в свой собственный чат.
export async function sendOrderExcel(buffer: ArrayBuffer, caption?: string) {
  console.log('📤 Sending Excel to Telegram...', {
    caption,
    bufferSize: buffer.byteLength,
  });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing');
    return;
  }

  const chatIds = new Set<string>();

  if (process.env.TELEGRAM_CHAT_ID) {
    chatIds.add(process.env.TELEGRAM_CHAT_ID);
  }

  const admins = await prisma.partner.findMany({
    where: { role: 'ADMIN', telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });

  for (const admin of admins) {
    if (admin.telegramChatId) {
      chatIds.add(admin.telegramChatId);
    }
  }

  if (chatIds.size === 0) {
    console.error('❌ No Telegram chat ids configured');
    return;
  }

  await Promise.all(
    [...chatIds].map((chatId) =>
      sendDocumentToChat(chatId, botToken, buffer, caption),
    ),
  );
}
