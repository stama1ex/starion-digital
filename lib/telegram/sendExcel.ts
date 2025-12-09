export async function sendOrderExcel(buffer: ArrayBuffer, caption?: string) {
  console.log('📤 Sending Excel to Telegram...', {
    caption,
    bufferSize: buffer.byteLength,
  });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('❌ Telegram ENV vars are missing');
    return;
  }

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
    console.error('❌ Failed to send Excel to Telegram:', errorText);
  } else {
    console.log('✅ Excel file sent to Telegram successfully');
  }
}
