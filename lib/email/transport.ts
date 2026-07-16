import nodemailer, { type Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

// Ленивая инициализация — транспорт создаётся только при первой реальной
// отправке письма, а не при загрузке модуля (см. урок с Firebase: eager-
// инициализация внешнего SDK на верхнем уровне модуля роняет SSR-рендер
// страниц, если конфиг ещё не заполнен).
function getTransporter(): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return cachedTransporter;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
}
