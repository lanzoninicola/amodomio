/*
  Warnings:

  - You are about to drop the column `flavor_1` on the `import_customer_service_pizza_medium_combinations` table. All the data in the column will be lost.
  - You are about to drop the column `flavor_2` on the `import_customer_service_pizza_medium_combinations` table. All the data in the column will be lost.
  - Added the required column `topping_1` to the `import_customer_service_pizza_medium_combinations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topping_2` to the `import_customer_service_pizza_medium_combinations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "import_customer_service_pizza_medium_combinations" DROP COLUMN "flavor_1",
DROP COLUMN "flavor_2",
ADD COLUMN     "topping_1" TEXT NOT NULL,
ADD COLUMN     "topping_2" TEXT NOT NULL;
