-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "production_base_recipe_ingredient_id" TEXT;

-- CreateTable
CREATE TABLE "recipe_preparations" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "sort_order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipe_preparations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_preparation_ingredients" (
    "id" TEXT NOT NULL,
    "preparation_id" TEXT NOT NULL,
    "recipe_ingredient_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipe_preparation_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "recipe_id" TEXT,
    "recipe_name" TEXT NOT NULL,
    "base_ingredient" TEXT NOT NULL,
    "base_quantity" DOUBLE PRECISION NOT NULL,
    "base_unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "production_date" TIMESTAMP(3) NOT NULL,
    "plan" JSONB NOT NULL,
    "notes" TEXT,
    "produced_quantity" DOUBLE PRECISION,
    "produced_unit" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_order_steps" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preparation_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "production_order_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_preparations_recipe_id_idx" ON "recipe_preparations"("recipe_id");
CREATE UNIQUE INDEX "recipe_prep_ingredients_prep_ingredient_unique" ON "recipe_preparation_ingredients"("preparation_id", "recipe_ingredient_id");
CREATE INDEX "recipe_prep_ingredients_recipe_ingredient_idx" ON "recipe_preparation_ingredients"("recipe_ingredient_id");
CREATE INDEX "production_orders_status_date_idx" ON "production_orders"("status", "production_date");
CREATE INDEX "production_orders_recipe_id_idx" ON "production_orders"("recipe_id");
CREATE INDEX "production_order_steps_order_idx" ON "production_order_steps"("order_id", "sort_order");

-- AddForeignKey
ALTER TABLE "recipe_preparations" ADD CONSTRAINT "recipe_preparations_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_preparation_ingredients" ADD CONSTRAINT "recipe_preparation_ingredients_preparation_id_fkey" FOREIGN KEY ("preparation_id") REFERENCES "recipe_preparations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_preparation_ingredients" ADD CONSTRAINT "recipe_preparation_ingredients_recipe_ingredient_id_fkey" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "recipe_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_order_steps" ADD CONSTRAINT "production_order_steps_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
