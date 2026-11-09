CREATE TABLE "recipe_templates" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipe_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipe_templates_recipe_id_created_at_idx"
    ON "recipe_templates"("recipe_id", "created_at");

ALTER TABLE "recipe_templates" ADD CONSTRAINT "recipe_templates_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
