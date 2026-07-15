-- CreateTable
CREATE TABLE "DefaultPrice" (
    "id" SERIAL NOT NULL,
    "type" "ProductType" NOT NULL,
    "groupId" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DefaultPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DefaultPrice_type_groupId_key" ON "DefaultPrice"("type", "groupId");

-- AddForeignKey
ALTER TABLE "DefaultPrice" ADD CONSTRAINT "DefaultPrice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
