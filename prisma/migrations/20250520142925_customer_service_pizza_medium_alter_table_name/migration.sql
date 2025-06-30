/*
  Warnings:

  - You are about to drop the column `sellprice_amount` on the `import_customer_service_pizza_medium_combinations` table. All the data in the column will be lost.
  - Added the required column `selling_price_amount` to the `import_customer_service_pizza_medium_combinations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "import_customer_service_pizza_medium_combinations" DROP COLUMN "sellprice_amount",
ADD COLUMN     "selling_price_amount" DOUBLE PRECISION NOT NULL;
