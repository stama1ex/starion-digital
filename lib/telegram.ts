export async function sendToTelegram(order: {
  partner: string;
  orderId: number;
  total: number;
  items: { number: string; qty: number; price: number; sum: number }[];
  comment?: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('Telegram ENV vars are not set.');
    return;
  }

  const escape = (text: string | number) =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const itemsFormatted = order.items
    .map(
      (i) =>
        `• <b>${escape(i.number)}</b>: ${escape(i.qty)} шт × ${escape(
          i.price
        )} = <b>${escape(i.sum)} MDL</b>`
    )
    .join('\n');

  const text =
    `📌 <b>Новый заказ №${escape(order.orderId)}</b>\n\n` +
    `👤 Покупатель: <b>${escape(order.partner)}</b>\n` +
    (order.comment
      ? `💬 Комментарий: <i>${escape(order.comment)}</i>\n\n`
      : `\n`) +
    `🛒 <b>Состав заказа:</b>\n${itemsFormatted}\n\n` +
    `💰 <b>Итого: ${escape(order.total)} MDL</b>`;

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    }
  );

  if (!res.ok) {
    console.error(await res.text());
  }

  return res.json();
}
