-- Add notes column to monthly closes for storing manual annotations
ALTER TABLE "financial_monthly_closes" ADD COLUMN IF NOT EXISTS "notes" TEXT;
