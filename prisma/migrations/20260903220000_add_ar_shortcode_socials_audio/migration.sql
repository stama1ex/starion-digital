-- AlterTable
ALTER TABLE "ARExperience" ADD COLUMN     "shortCode" TEXT,
ADD COLUMN     "socials" JSONB,
ADD COLUMN     "audioTracks" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ARExperience_shortCode_key" ON "ARExperience"("shortCode");
