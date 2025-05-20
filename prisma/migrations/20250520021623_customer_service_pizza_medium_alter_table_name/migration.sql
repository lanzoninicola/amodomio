/*
  Warnings:

  - You are about to drop the `customer_service_pizza_medium_combinations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "customer_service_pizza_medium_combinations";

-- CreateTable
CREATE TABLE "import_customer_service_pizza_medium_combinations" (
    "id" TEXT NOT NULL,
    "flavor_1" TEXT NOT NULL,
    "flavor_2" TEXT NOT NULL,
    "sellprice_amount" DOUBLE PRECISION NOT NULL,
    "break_even_price_amount" DOUBLE PRECISION NOT NULL,
    "real_margin_perc" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "import_customer_service_pizza_medium_combinations_pkey" PRIMARY KEY ("id")
);
