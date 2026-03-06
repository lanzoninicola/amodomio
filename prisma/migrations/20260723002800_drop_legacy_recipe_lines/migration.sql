-- Remove legacy recipe line table after migration to recipe_ingredients + recipe_variation_ingredients
DROP TABLE IF EXISTS "recipe_lines";
