ALTER TABLE "suppliers"
ADD COLUMN IF NOT EXISTS "cnpj" TEXT;

CREATE INDEX IF NOT EXISTS "suppliers_cnpj_idx" ON "suppliers"("cnpj");
