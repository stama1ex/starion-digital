-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "RealizationPayment" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
