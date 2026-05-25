-- CreateTable
CREATE TABLE "PartnerSession" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "bindHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSession_tokenHash_key" ON "PartnerSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSession_bindHash_key" ON "PartnerSession"("bindHash");

-- CreateIndex
CREATE INDEX "PartnerSession_partnerId_idx" ON "PartnerSession"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerSession_expiresAt_idx" ON "PartnerSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PartnerSession" ADD CONSTRAINT "PartnerSession_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
