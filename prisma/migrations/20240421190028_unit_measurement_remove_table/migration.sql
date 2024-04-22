/*
  Warnings:

  - The values [topping] on the enum `RecipeType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `unit_id` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `unitId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `units` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RecipeType_new" AS ENUM ('semi-finished', 'pizza-topping');
ALTER TABLE "recipes" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "recipes" ALTER COLUMN "type" TYPE "RecipeType_new" USING ("type"::text::"RecipeType_new");
ALTER TYPE "RecipeType" RENAME TO "RecipeType_old";
ALTER TYPE "RecipeType_new" RENAME TO "RecipeType";
DROP TYPE "RecipeType_old";
ALTER TABLE "recipes" ALTER COLUMN "type" SET DEFAULT 'semi-finished';
COMMIT;

-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_unitId_fkey";

-- AlterTable
ALTER TABLE "ingredients" DROP COLUMN "unit_id",
ADD COLUMN     "um" TEXT DEFAULT 'UN';

-- AlterTable
ALTER TABLE "products" DROP COLUMN "unitId",
ADD COLUMN     "um" TEXT DEFAULT 'UN';

-- DropTable
DROP TABLE "units";
