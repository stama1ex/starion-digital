-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "RealizationItem_realizationId_idx" ON "RealizationItem"("realizationId");

-- CreateIndex
CREATE INDEX "RealizationItem_productId_idx" ON "RealizationItem"("productId");
