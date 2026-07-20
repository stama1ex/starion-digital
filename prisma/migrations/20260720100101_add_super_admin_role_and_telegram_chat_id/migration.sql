-- AlterEnum
ALTER TYPE "PartnerRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "telegramChatId" TEXT;
