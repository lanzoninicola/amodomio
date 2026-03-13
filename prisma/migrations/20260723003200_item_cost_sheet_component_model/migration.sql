CREATE TABLE "item_cost_sheet_components" (
    "id" TEXT NOT NULL,
    "item_cost_sheet_id" TEXT NOT NULL,
    "type" "RecipeSheetLineType" NOT NULL DEFAULT 'manual',
    "ref_id" TEXT,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_cost_sheet_components_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_cost_sheet_variation_components" (
    "id" TEXT NOT NULL,
    "item_cost_sheet_component_id" TEXT NOT NULL,
    "item_variation_id" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waste_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_cost_sheet_variation_components_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_cost_sheet_components_sheet_idx"
ON "item_cost_sheet_components"("item_cost_sheet_id");

CREATE INDEX "item_cost_sheet_variation_components_item_variation_idx"
ON "item_cost_sheet_variation_components"("item_variation_id");

CREATE INDEX "item_cost_sheet_variation_components_component_idx"
ON "item_cost_sheet_variation_components"("item_cost_sheet_component_id");

CREATE UNIQUE INDEX "item_cost_sheet_variation_components_component_variation_unique"
ON "item_cost_sheet_variation_components"("item_cost_sheet_component_id", "item_variation_id");

ALTER TABLE "item_cost_sheet_components"
ADD CONSTRAINT "item_cost_sheet_components_item_cost_sheet_id_fkey"
FOREIGN KEY ("item_cost_sheet_id") REFERENCES "item_cost_sheets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_cost_sheet_variation_components"
ADD CONSTRAINT "item_cost_sheet_variation_components_component_id_fkey"
FOREIGN KEY ("item_cost_sheet_component_id") REFERENCES "item_cost_sheet_components"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_cost_sheet_variation_components"
ADD CONSTRAINT "item_cost_sheet_variation_components_item_variation_id_fkey"
FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
