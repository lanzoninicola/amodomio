ALTER TABLE "menu_engineering_imports"
  ADD COLUMN "period_start" TIMESTAMP(3),
  ADD COLUMN "period_end" TIMESTAMP(3),
  ADD COLUMN "total_items_sold" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "total_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "total_pizzas" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "pizza_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "menu_engineering_imports"
SET
  "period_start" = make_date("year", "month", 1)::timestamp,
  "period_end" = (make_date("year", "month", 1) + INTERVAL '1 month - 1 day')::timestamp
WHERE "period_start" IS NULL OR "period_end" IS NULL;

ALTER TABLE "menu_engineering_imports"
  ALTER COLUMN "period_start" SET NOT NULL,
  ALTER COLUMN "period_end" SET NOT NULL;

ALTER TABLE "menu_engineering_import_items"
  ALTER COLUMN "quantity" TYPE DOUBLE PRECISION USING "quantity"::double precision;

ALTER TABLE "menu_engineering_imports"
  DROP CONSTRAINT IF EXISTS "menu_engineering_imports_month_year_key";

CREATE UNIQUE INDEX "menu_engineering_imports_period_start_period_end_key"
  ON "menu_engineering_imports"("period_start", "period_end");

CREATE INDEX "menu_engineering_imports_year_month_idx"
  ON "menu_engineering_imports"("year", "month");
