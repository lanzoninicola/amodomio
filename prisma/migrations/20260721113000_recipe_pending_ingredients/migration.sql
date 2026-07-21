CREATE TABLE "recipe_pending_ingredients" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_pending_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_pending_ingredients_recipe_section_name_unique"
ON "recipe_pending_ingredients"("recipe_id", "section", "normalized_name");

CREATE INDEX "recipe_pending_ingredients_recipe_status_idx"
ON "recipe_pending_ingredients"("recipe_id", "status");

ALTER TABLE "recipe_pending_ingredients"
ADD CONSTRAINT "recipe_pending_ingredients_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
