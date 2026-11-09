CREATE TABLE "recipe_preheating" (
  "id" TEXT NOT NULL,
  "recipe_id" TEXT NOT NULL,
  "upper_temperature_celsius" DOUBLE PRECISION,
  "lower_temperature_celsius" DOUBLE PRECISION,
  "duration_minutes" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recipe_preheating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_baking" (
  "id" TEXT NOT NULL,
  "recipe_id" TEXT NOT NULL,
  "upper_temperature_celsius" DOUBLE PRECISION,
  "lower_temperature_celsius" DOUBLE PRECISION,
  "duration_minutes" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recipe_baking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_preheating_recipe_id_key"
ON "recipe_preheating"("recipe_id");

CREATE UNIQUE INDEX "recipe_baking_recipe_id_key"
ON "recipe_baking"("recipe_id");

ALTER TABLE "recipe_preheating"
ADD CONSTRAINT "recipe_preheating_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipe_baking"
ADD CONSTRAINT "recipe_baking_recipe_id_fkey"
FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
