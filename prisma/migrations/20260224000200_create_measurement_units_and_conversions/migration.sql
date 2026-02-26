CREATE TABLE "measurement_units" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "measurement_units_code_unique" ON "measurement_units"("code");
CREATE INDEX "measurement_units_active_code_idx" ON "measurement_units"("active", "code");

CREATE TABLE "measurement_unit_conversions" (
  "id" TEXT NOT NULL,
  "from_unit_id" TEXT NOT NULL,
  "to_unit_id" TEXT NOT NULL,
  "factor" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "measurement_unit_conversions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "measurement_unit_conversions_from_to_unique"
  ON "measurement_unit_conversions"("from_unit_id", "to_unit_id");
CREATE INDEX "measurement_unit_conversions_from_idx"
  ON "measurement_unit_conversions"("from_unit_id");
CREATE INDEX "measurement_unit_conversions_to_idx"
  ON "measurement_unit_conversions"("to_unit_id");

ALTER TABLE "measurement_unit_conversions"
  ADD CONSTRAINT "measurement_unit_conversions_from_unit_id_fkey"
  FOREIGN KEY ("from_unit_id") REFERENCES "measurement_units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "measurement_unit_conversions"
  ADD CONSTRAINT "measurement_unit_conversions_to_unit_id_fkey"
  FOREIGN KEY ("to_unit_id") REFERENCES "measurement_units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
