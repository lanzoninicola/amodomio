/*
  Warnings:

  - You are about to drop the column `product_ref_id` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `recipe_ref_id` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `um` on the `ingredients` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_product_ref_id_fkey";

-- DropForeignKey
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_recipe_ref_id_fkey";

-- AlterTable
ALTER TABLE "ingredients" DROP COLUMN "product_ref_id",
DROP COLUMN "quantity",
DROP COLUMN "recipe_ref_id",
DROP COLUMN "type",
DROP COLUMN "um",
ALTER COLUMN "name" SET DATA TYPE VARCHAR;

-- CreateTable
CREATE TABLE "recipes_ingredients" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "um" VARCHAR NOT NULL,
    "quantity" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes_ingredients_links" (
    "id" TEXT NOT NULL,
    "recipe_ingredient_id" TEXT NOT NULL,
    "type" VARCHAR NOT NULL,
    "productId" TEXT,
    "recipeId" TEXT,

    CONSTRAINT "recipes_ingredients_links_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recipes_ingredients" ADD CONSTRAINT "recipes_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes_ingredients" ADD CONSTRAINT "recipes_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes_ingredients_links" ADD CONSTRAINT "recipes_ingredients_links_recipe_ingredient_id_fkey" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "recipes_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes_ingredients_links" ADD CONSTRAINT "recipes_ingredients_links_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes_ingredients_links" ADD CONSTRAINT "recipes_ingredients_links_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
