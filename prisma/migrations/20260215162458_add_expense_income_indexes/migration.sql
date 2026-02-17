-- CreateIndex
CREATE INDEX "expenses_user_id_date_idx" ON "expenses"("user_id", "date" DESC);

-- CreateIndex
CREATE INDEX "expenses_user_id_category_idx" ON "expenses"("user_id", "category");

-- CreateIndex
CREATE INDEX "incomes_user_id_date_idx" ON "incomes"("user_id", "date" DESC);

-- CreateIndex
CREATE INDEX "incomes_user_id_category_idx" ON "incomes"("user_id", "category");
