-- Add owner scoping for online multi-user data.
ALTER TABLE "Account" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Income" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLog" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingGoal" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD COLUMN "ownerId" INTEGER REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "Account_name_key";
DROP INDEX "Category_name_kind_key";

CREATE UNIQUE INDEX "Account_ownerId_name_key" ON "Account"("ownerId", "name");
CREATE INDEX "Account_ownerId_idx" ON "Account"("ownerId");
CREATE UNIQUE INDEX "Category_ownerId_name_kind_key" ON "Category"("ownerId", "name", "kind");
CREATE INDEX "Category_ownerId_idx" ON "Category"("ownerId");
CREATE INDEX "Income_ownerId_idx" ON "Income"("ownerId");
CREATE INDEX "Expense_ownerId_idx" ON "Expense"("ownerId");
CREATE INDEX "WorkLog_ownerId_idx" ON "WorkLog"("ownerId");
CREATE INDEX "Loan_ownerId_idx" ON "Loan"("ownerId");
CREATE INDEX "SavingGoal_ownerId_idx" ON "SavingGoal"("ownerId");
CREATE INDEX "Note_ownerId_idx" ON "Note"("ownerId");
