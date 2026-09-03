-- AlterTable
ALTER TABLE "ARExperience" ADD COLUMN     "socials" JSONB,
ADD COLUMN     "audioTracks" JSONB,
ADD COLUMN     "whiteLabel" BOOLEAN NOT NULL DEFAULT false;
