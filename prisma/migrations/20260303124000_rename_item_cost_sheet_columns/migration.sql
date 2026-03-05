-- Rename columns to align with item_cost_* naming
ALTER TABLE "item_cost_sheet_lines" RENAME COLUMN "recipe_sheet_id" TO "item_cost_sheet_id";
ALTER TABLE "item_cost_sheets" RENAME COLUMN "base_recipe_sheet_id" TO "base_item_cost_sheet_id";

-- Rename foreign key constraints
ALTER TABLE "item_cost_sheet_lines" RENAME CONSTRAINT "recipe_sheet_lines_recipe_sheet_id_fkey" TO "item_cost_sheet_lines_item_cost_sheet_id_fkey";
ALTER TABLE "item_cost_sheets" RENAME CONSTRAINT "recipe_sheets_base_recipe_sheet_id_fkey" TO "item_cost_sheets_base_item_cost_sheet_id_fkey";
