import { prisma } from '@/lib/prisma';

// Общая проверка, что логин и email ещё свободны — используется и для
// быстрой пред-проверки перед отправкой кода (чтобы не гонять письмо и не
// заставлять человека вводить код, если логин/email уже заняты), и как
// финальный барьер перед созданием заявки (на случай гонки — кто-то мог
// занять логин/email, пока пользователь вводил код).
export async function checkPartnershipAvailability(
  login: string,
  email: string,
): Promise<string | null> {
  const existingPartner = await prisma.partner.findUnique({
    where: { login },
  });
  if (existingPartner) {
    return 'Этот логин уже используется';
  }

  const existingPartnerByEmail = await prisma.partner.findUnique({
    where: { email },
  });
  if (existingPartnerByEmail) {
    return 'Этот email уже используется другим аккаунтом';
  }

  const existingRequest = await prisma.partnershipRequest.findFirst({
    where: { login, status: 'PENDING' },
  });
  if (existingRequest) {
    return 'Заявка с этим логином уже подана';
  }

  const existingRequestByEmail = await prisma.partnershipRequest.findFirst({
    where: { email, status: 'PENDING' },
  });
  if (existingRequestByEmail) {
    return 'Заявка с этим email уже подана';
  }

  return null;
}
