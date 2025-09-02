-- CreateIndex
CREATE INDEX "fdg_is_active_created_at_idx" ON "financial_daily_goals"("is_active", "created_at");

-- CreateIndex
CREATE INDEX "fdg_summary_created_at_idx" ON "financial_daily_goals"("financial_summary_id", "created_at");
