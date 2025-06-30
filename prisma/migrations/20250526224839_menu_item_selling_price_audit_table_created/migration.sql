-- CreateTable
CREATE TABLE "menu_item_selling_prices_audit" (
    "id" TEXT NOT NULL,
    "menu_item_selling_price_variation_id" TEXT NOT NULL,
    "recipe_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packaging_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dough_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waste_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dna_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit_expected_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit_actual_perc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "menu_item_selling_prices_audit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_selling_prices_audit" ADD CONSTRAINT "menu_item_selling_prices_audit_menu_item_selling_price_var_fkey" FOREIGN KEY ("menu_item_selling_price_variation_id") REFERENCES "menu_item_selling_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
