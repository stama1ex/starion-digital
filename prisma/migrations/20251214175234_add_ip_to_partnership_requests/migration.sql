-- AlterTable
ALTER TABLE "PartnershipRequest" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "PartnershipRequest_ipAddress_createdAt_idx" ON "PartnershipRequest"("ipAddress", "createdAt");
