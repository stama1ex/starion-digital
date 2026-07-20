-- CreateTable
CREATE TABLE "OrderChangeLog" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "changedById" INTEGER,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderChangeLog_orderId_idx" ON "OrderChangeLog"("orderId");

-- AddForeignKey
ALTER TABLE "OrderChangeLog" ADD CONSTRAINT "OrderChangeLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChangeLog" ADD CONSTRAINT "OrderChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
