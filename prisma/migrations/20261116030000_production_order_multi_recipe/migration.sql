ALTER TABLE "production_order_templates" ADD COLUMN "items" JSONB;
ALTER TABLE "production_orders" ADD COLUMN "items" JSONB;
ALTER TABLE "production_order_steps"
  ADD COLUMN "item_index" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recipe_name" TEXT,
  ADD COLUMN "scheduled_start_at" TIMESTAMP(3),
  ADD COLUMN "scheduled_end_at" TIMESTAMP(3);

UPDATE "production_order_steps" AS step
SET "recipe_name" = production."recipe_name"
FROM "production_orders" AS production
WHERE step."order_id" = production."id";

CREATE INDEX "production_order_steps_schedule_idx"
  ON "production_order_steps"("scheduled_start_at", "scheduled_end_at");
