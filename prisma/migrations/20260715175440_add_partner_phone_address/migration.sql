-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "PartnershipRequest" ADD COLUMN     "address" TEXT;
