-- CreateTable
CREATE TABLE "import_customer_service_pizza_bigger_combinations" (
    "id" TEXT NOT NULL,
    "topping_1" TEXT NOT NULL,
    "ingredient_1" TEXT NOT NULL,
    "topping_2" TEXT NOT NULL,
    "ingredient_2" TEXT NOT NULL,
    "topping_3" TEXT NOT NULL,
    "ingredient_3" TEXT NOT NULL,
    "topping_4" TEXT NOT NULL,
    "ingredient_4" TEXT NOT NULL,
    "selling_price_amount" DOUBLE PRECISION NOT NULL,
    "break_even_price_amount" DOUBLE PRECISION NOT NULL,
    "real_margin_perc" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "import_customer_service_pizza_bigger_combinations_pkey" PRIMARY KEY ("id")
);
