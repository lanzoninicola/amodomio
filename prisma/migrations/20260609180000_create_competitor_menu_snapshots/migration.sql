CREATE TABLE "competitor_menu_snapshots" (
  "id" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "collected_at" TIMESTAMP(3) NOT NULL,
  "restaurant_count" INTEGER NOT NULL,
  "excluded_count" INTEGER NOT NULL,
  "target_categories" JSONB NOT NULL,
  "raw_data" JSONB NOT NULL,
  "original_file_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competitor_menu_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competitor_menu_snapshots_city_collected_at_key"
ON "competitor_menu_snapshots"("city", "collected_at");

CREATE INDEX "competitor_menu_snapshots_collected_at_idx"
ON "competitor_menu_snapshots"("collected_at");
