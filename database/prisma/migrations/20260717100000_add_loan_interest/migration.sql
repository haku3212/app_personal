ALTER TABLE "Loan" ADD COLUMN "interestRate" REAL;
ALTER TABLE "LoanPayment" ADD COLUMN "principalAmount" REAL;
ALTER TABLE "LoanPayment" ADD COLUMN "interestAmount" REAL;

UPDATE "Loan" SET "interestRate" = 0 WHERE "interestRate" IS NULL;
UPDATE "LoanPayment" SET "principalAmount" = "amount" WHERE "principalAmount" IS NULL;
UPDATE "LoanPayment" SET "interestAmount" = 0 WHERE "interestAmount" IS NULL;
