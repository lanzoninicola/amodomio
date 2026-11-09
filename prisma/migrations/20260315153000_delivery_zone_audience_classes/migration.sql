ALTER TABLE "delivery_zones"
ADD COLUMN "audience_classes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
