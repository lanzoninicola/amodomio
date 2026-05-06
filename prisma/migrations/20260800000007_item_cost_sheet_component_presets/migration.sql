CREATE TABLE "item_cost_sheet_component_presets" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "type" "RecipeSheetLineType" NOT NULL DEFAULT 'manual',
  "name" TEXT NOT NULL,
  "unit" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "waste_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_cost_sheet_component_presets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_cost_sheet_component_presets_key_key"
  ON "item_cost_sheet_component_presets"("key");

CREATE INDEX "item_cost_sheet_component_presets_type_active_idx"
  ON "item_cost_sheet_component_presets"("type", "active", "sort_order_index");

ALTER TABLE "item_cost_sheet_components"
  ADD COLUMN "preset_id" TEXT;

CREATE INDEX "item_cost_sheet_components_preset_idx"
  ON "item_cost_sheet_components"("preset_id");

ALTER TABLE "item_cost_sheet_components"
  ADD CONSTRAINT "item_cost_sheet_components_preset_id_fkey"
  FOREIGN KEY ("preset_id") REFERENCES "item_cost_sheet_component_presets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "item_cost_sheet_component_presets" (
  "id",
  "key",
  "type",
  "name",
  "unit",
  "quantity",
  "unit_cost_amount",
  "waste_perc",
  "notes",
  "sort_order_index"
) VALUES
  ('preset-manual-embalagem-pizza', 'manual.embalagem-pizza', 'manual', 'Embalagem pizza', 'UN', 1, 0, 0, 'Preset para embalagem usada na venda.', 10),
  ('preset-manual-embalagem-delivery', 'manual.embalagem-delivery', 'manual', 'Embalagem delivery', 'UN', 1, 0, 0, 'Preset para embalagem de entrega.', 20),
  ('preset-manual-ajuste-operacional', 'manual.ajuste-operacional', 'manual', 'Ajuste operacional', 'UN', 1, 0, 0, 'Preset para custo operacional avulso.', 30),
  ('preset-labor-producao', 'labor.producao', 'labor', 'Mão de obra produção', 'H', 1, 0, 0, 'Preset para mão de obra de preparo.', 10),
  ('preset-labor-finalizacao', 'labor.finalizacao', 'labor', 'Mão de obra finalização', 'H', 1, 0, 0, 'Preset para mão de obra de montagem/finalização.', 20)
ON CONFLICT ("key") DO NOTHING;
