-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdById" INTEGER;

-- CreateIndex
CREATE INDEX "Order_createdById_idx" ON "Order"("createdById");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
