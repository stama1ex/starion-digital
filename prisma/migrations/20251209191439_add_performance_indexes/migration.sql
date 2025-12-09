-- CreateIndex
CREATE INDEX "Order_partnerId_idx" ON "Order"("partnerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_partnerId_status_idx" ON "Order"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Realization_partnerId_idx" ON "Realization"("partnerId");

-- CreateIndex
CREATE INDEX "Realization_status_idx" ON "Realization"("status");

-- CreateIndex
CREATE INDEX "Realization_createdAt_idx" ON "Realization"("createdAt");
