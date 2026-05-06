ALTER TABLE "item_cost_sheet_component_presets"
  ADD COLUMN "variation_id" TEXT;

CREATE INDEX "item_cost_sheet_component_presets_variation_idx"
  ON "item_cost_sheet_component_presets"("variation_id");

ALTER TABLE "item_cost_sheet_component_presets"
  ADD CONSTRAINT "item_cost_sheet_component_presets_variation_id_fkey"
  FOREIGN KEY ("variation_id") REFERENCES "variations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
