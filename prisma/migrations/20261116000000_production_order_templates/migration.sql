CREATE TABLE "production_order_templates" (
  "id" TEXT NOT NULL,
  "number" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "recipe_id" TEXT,
  "recipe_name" TEXT NOT NULL,
  "base_ingredient" TEXT NOT NULL,
  "base_quantity" DOUBLE PRECISION NOT NULL,
  "base_unit" TEXT NOT NULL,
  "plan" JSONB NOT NULL,
  "notes" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_order_templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "production_orders" ADD COLUMN "template_id" TEXT;

-- Cada OP anterior vira um cadastro reutilizavel, preservando todo o historico.
INSERT INTO "production_order_templates" (
  "id", "name", "recipe_id", "recipe_name", "base_ingredient",
  "base_quantity", "base_unit", "plan", "notes", "created_at", "updated_at"
)
SELECT
  'legacy-' || "id", "recipe_name", "recipe_id", "recipe_name", "base_ingredient",
  "base_quantity", "base_unit", "plan", "notes", "created_at", "updated_at"
FROM "production_orders";

UPDATE "production_orders"
SET "template_id" = 'legacy-' || "id"
WHERE "template_id" IS NULL;

CREATE INDEX "production_order_templates_archived_name_idx" ON "production_order_templates"("archived_at", "name");
CREATE INDEX "production_order_templates_recipe_id_idx" ON "production_order_templates"("recipe_id");
CREATE INDEX "production_orders_template_id_idx" ON "production_orders"("template_id");
ALTER TABLE "production_order_templates" ADD CONSTRAINT "production_order_templates_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "production_order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
