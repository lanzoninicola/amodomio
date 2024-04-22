/*
  Warnings:

  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ingredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Recipe` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeVariation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Unit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CategorySubCategories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Ingredient" DROP CONSTRAINT "Ingredient_product_ref_id_fkey";

-- DropForeignKey
ALTER TABLE "Ingredient" DROP CONSTRAINT "Ingredient_recipe_ref_id_fkey";

-- DropForeignKey
ALTER TABLE "Ingredient" DROP CONSTRAINT "Ingredient_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_category_id_fkey";

-- DropForeignKey
ALTER TABLE "RecipeVariation" DROP CONSTRAINT "RecipeVariation_recipe_id_fkey";

-- DropForeignKey
ALTER TABLE "_CategorySubCategories" DROP CONSTRAINT "_CategorySubCategories_A_fkey";

-- DropForeignKey
ALTER TABLE "_CategorySubCategories" DROP CONSTRAINT "_CategorySubCategories_B_fkey";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Ingredient";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "Recipe";

-- DropTable
DROP TABLE "RecipeVariation";

-- DropTable
DROP TABLE "SubCategory";

-- DropTable
DROP TABLE "Unit";

-- DropTable
DROP TABLE "_CategorySubCategories";
