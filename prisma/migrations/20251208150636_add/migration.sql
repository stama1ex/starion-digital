-- CreateEnum
CREATE TYPE "RealizationStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Realization" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "RealizationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Realization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealizationItem" (
    "id" SERIAL NOT NULL,
    "realizationId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "paidQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RealizationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealizationPayment" (
    "id" SERIAL NOT NULL,
    "realizationId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealizationPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Realization_orderId_key" ON "Realization"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Realization" ADD CONSTRAINT "Realization_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Realization" ADD CONSTRAINT "Realization_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizationItem" ADD CONSTRAINT "RealizationItem_realizationId_fkey" FOREIGN KEY ("realizationId") REFERENCES "Realization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizationItem" ADD CONSTRAINT "RealizationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizationPayment" ADD CONSTRAINT "RealizationPayment_realizationId_fkey" FOREIGN KEY ("realizationId") REFERENCES "Realization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
