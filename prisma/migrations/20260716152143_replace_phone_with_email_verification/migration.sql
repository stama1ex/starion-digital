-- AlterTable
ALTER TABLE "Partner" DROP COLUMN "phoneVerified",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartnershipRequest" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "EmailVerificationCode" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerificationCode_email_idx" ON "EmailVerificationCode"("email");
