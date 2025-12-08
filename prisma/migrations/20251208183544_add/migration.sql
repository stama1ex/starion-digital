/*
  Warnings:

  - You are about to drop the column `material` on the `Price` table. All the data in the column will be lost.
  - You are about to drop the column `material` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[partnerId,type,materialId]` on the table `Price` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `materialId` to the `Price` table without a default value. This is not possible if the table is not empty.
  - Added the required column `materialId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Price_partnerId_type_material_key";

-- CreateTable MaterialCatalog first (before altering other tables)
CREATE TABLE "MaterialCatalog" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialCatalog_name_key" ON "MaterialCatalog"("name");

-- Insert default materials
INSERT INTO "MaterialCatalog" ("name", "label") VALUES 
('MARBLE', 'Мрамор'),
('WOOD', 'Дерево'),
('ACRYLIC', 'Акрил');

-- AlterTable Product - add materialId with mapping from material enum
ALTER TABLE "Product" ADD COLUMN "materialId" INTEGER;

-- Map existing materials to new IDs
UPDATE "Product" SET "materialId" = (
  SELECT "MaterialCatalog"."id" FROM "MaterialCatalog" 
  WHERE "MaterialCatalog"."name" = "Product"."material"::text
);

-- Make materialId NOT NULL after populating
ALTER TABLE "Product" ALTER COLUMN "materialId" SET NOT NULL;

-- Drop old material column
ALTER TABLE "Product" DROP COLUMN "material";

-- AlterTable Price - add materialId with mapping from material enum
ALTER TABLE "Price" ADD COLUMN "materialId" INTEGER;

-- Map existing materials to new IDs
UPDATE "Price" SET "materialId" = (
  SELECT "MaterialCatalog"."id" FROM "MaterialCatalog" 
  WHERE "MaterialCatalog"."name" = "Price"."material"::text
);

-- Make materialId NOT NULL after populating
ALTER TABLE "Price" ALTER COLUMN "materialId" SET NOT NULL;

-- Drop old material column
ALTER TABLE "Price" DROP COLUMN "material";

-- DropEnum
DROP TYPE "Material";

-- CreateIndex
CREATE UNIQUE INDEX "Price_partnerId_type_materialId_key" ON "Price"("partnerId", "type", "materialId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
