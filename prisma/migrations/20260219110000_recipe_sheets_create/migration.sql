-- CreateEnum
CREATE TYPE "RecipeSheetStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "RecipeSheetLineType" AS ENUM ('product', 'recipe', 'manual');

-- CreateTable
CREATE TABLE "recipe_sheets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "menu_item_id" TEXT NOT NULL,
    "menu_item_size_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RecipeSheetStatus" NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "base_recipe_sheet_id" TEXT,
    "cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "activated_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_sheet_lines" (
    "id" TEXT NOT NULL,
    "recipe_sheet_id" TEXT NOT NULL,
    "type" "RecipeSheetLineType" NOT NULL DEFAULT 'manual',
    "ref_id" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waste_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_sheet_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_sheets_item_size_idx" ON "recipe_sheets"("menu_item_id", "menu_item_size_id");

-- CreateIndex
CREATE INDEX "recipe_sheets_item_size_active_idx" ON "recipe_sheets"("menu_item_id", "menu_item_size_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_sheets_item_size_version_unique" ON "recipe_sheets"("menu_item_id", "menu_item_size_id", "version");

-- CreateIndex
CREATE INDEX "recipe_sheet_lines_sheet_idx" ON "recipe_sheet_lines"("recipe_sheet_id");

-- AddForeignKey
ALTER TABLE "recipe_sheets" ADD CONSTRAINT "recipe_sheets_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_sheets" ADD CONSTRAINT "recipe_sheets_menu_item_size_id_fkey" FOREIGN KEY ("menu_item_size_id") REFERENCES "menu_item_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_sheets" ADD CONSTRAINT "recipe_sheets_base_recipe_sheet_id_fkey" FOREIGN KEY ("base_recipe_sheet_id") REFERENCES "recipe_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_sheet_lines" ADD CONSTRAINT "recipe_sheet_lines_recipe_sheet_id_fkey" FOREIGN KEY ("recipe_sheet_id") REFERENCES "recipe_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
