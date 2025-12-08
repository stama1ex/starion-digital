-- CreateEnum
CREATE TYPE "PartnerRole" AS ENUM ('ADMIN', 'PARTNER');

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "role" "PartnerRole" NOT NULL DEFAULT 'PARTNER';
