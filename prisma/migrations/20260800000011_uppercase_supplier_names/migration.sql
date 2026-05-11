UPDATE "suppliers"
SET "name" = UPPER(TRIM("name"))
WHERE "name" IS NOT NULL
  AND "name" <> UPPER(TRIM("name"));

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_cnpj_unique_not_empty_idx"
  ON "suppliers" ("cnpj")
  WHERE "cnpj" IS NOT NULL AND BTRIM("cnpj") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_name_unique_without_cnpj_idx"
  ON "suppliers" ((UPPER(BTRIM("name"))))
  WHERE COALESCE(NULLIF(BTRIM("cnpj"), ''), '') = '';
