export async function sendOrderExcel(buffer: ArrayBuffer) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('Telegram ENV vars are missing');
    return;
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', new Blob([buffer]), 'order.xlsx');

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    {
      method: 'POST',
      body: form,
    }
  );

  if (!res.ok) console.error(await res.text());
}
