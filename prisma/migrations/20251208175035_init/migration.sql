-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MAGNET', 'PLATE', 'POSTCARD', 'STATUE', 'BALL');

-- CreateEnum
CREATE TYPE "Material" AS ENUM ('MARBLE', 'WOOD', 'ACRYLIC');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'APPROVED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RealizationStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "type" "ProductType" NOT NULL,
    "number" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "material" "Material" NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "type" "ProductType" NOT NULL,
    "material" "Material" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerItem" DECIMAL(10,2) NOT NULL,
    "sum" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "Partner_login_key" ON "Partner"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Product_number_key" ON "Product"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Price_partnerId_type_material_key" ON "Price"("partnerId", "type", "material");

-- CreateIndex
CREATE UNIQUE INDEX "Realization_orderId_key" ON "Realization"("orderId");

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
