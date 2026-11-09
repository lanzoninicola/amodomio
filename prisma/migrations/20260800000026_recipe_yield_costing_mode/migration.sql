ALTER TABLE "recipes"
ADD COLUMN "costing_mode" TEXT NOT NULL DEFAULT 'per_variation',
ADD COLUMN "yield_quantity" DOUBLE PRECISION,
ADD COLUMN "yield_unit" VARCHAR;

