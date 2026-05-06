-- Rename tables to align naming with ItemCostSheet models
ALTER TABLE "recipe_sheet_lines" RENAME TO "item_cost_sheet_lines";
ALTER TABLE "recipe_sheets" RENAME TO "item_cost_sheets";

-- Rename indexes to match new table names
ALTER INDEX "recipe_sheet_lines_sheet_idx" RENAME TO "item_cost_sheet_lines_sheet_idx";
ALTER INDEX "recipe_sheets_item_id_idx" RENAME TO "item_cost_sheets_item_id_idx";
ALTER INDEX "recipe_sheets_item_variation_id_idx" RENAME TO "item_cost_sheets_item_variation_id_idx";
ALTER INDEX "recipe_sheets_item_variation_idx" RENAME TO "item_cost_sheets_item_variation_idx";
ALTER INDEX "recipe_sheets_item_variation_active_idx" RENAME TO "item_cost_sheets_item_variation_active_idx";
ALTER INDEX "recipe_sheets_item_variation_version_unique" RENAME TO "item_cost_sheets_item_variation_version_unique";
