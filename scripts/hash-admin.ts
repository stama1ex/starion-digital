import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  // Получаем пароль из аргументов командной строки
  const plain = process.argv[2];

  if (!plain) {
    console.error('Usage: ts-node scripts/hash-admin.ts <PASSWORD>');
    console.error('Example: ts-node scripts/hash-admin.ts mySecretPassword123');
    process.exit(1);
  }

  if (plain.length < 8) {
    console.error('❌ Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    // Проверяем что партнёр существует
    const partner = await prisma.partner.findUnique({
      where: { login: 'yurix13' },
    });

    if (!partner) {
      console.error('❌ Partner with login "yurix13" not found');
      process.exit(1);
    }

    // Хешируем пароль
    const hash = await bcrypt.hash(plain, 10);

    // Обновляем пароль и роль
    await prisma.partner.update({
      where: { login: 'yurix13' },
      data: {
        password: hash,
        role: 'ADMIN',
      },
    });

    console.log('✅ Admin password successfully updated');
    console.log(`📧 Login: <hidden>`);
    console.log(`🔐 Password: <hidden>`);
    console.log(`👤 Role: ADMIN`);
  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
