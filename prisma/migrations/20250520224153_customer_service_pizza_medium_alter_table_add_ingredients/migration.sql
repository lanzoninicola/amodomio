/*
  Warnings:

  - Added the required column `ingredient_1` to the `import_customer_service_pizza_medium_combinations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredient_2` to the `import_customer_service_pizza_medium_combinations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "import_customer_service_pizza_medium_combinations" ADD COLUMN     "ingredient_1" TEXT NOT NULL,
ADD COLUMN     "ingredient_2" TEXT NOT NULL;
