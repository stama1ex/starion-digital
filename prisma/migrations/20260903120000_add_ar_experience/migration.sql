-- CreateEnum
CREATE TYPE "ARContentType" AS ENUM ('VIDEO', 'MODEL3D', 'ANIMATION');

-- CreateTable
CREATE TABLE "ARExperience" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" "ARContentType" NOT NULL,
    "markerUrl" TEXT NOT NULL,
    "mindFileUrl" TEXT NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotationX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offsetZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "loop" BOOLEAN NOT NULL DEFAULT true,
    "sound" BOOLEAN NOT NULL DEFAULT false,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ARExperience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ARExperience_slug_key" ON "ARExperience"("slug");

-- CreateIndex
CREATE INDEX "ARExperience_productId_idx" ON "ARExperience"("productId");

-- CreateIndex
CREATE INDEX "ARExperience_isActive_idx" ON "ARExperience"("isActive");

-- AddForeignKey
ALTER TABLE "ARExperience" ADD CONSTRAINT "ARExperience_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
