CREATE TABLE "item_labeling_configs" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "shelf_life_minutes" INTEGER NOT NULL,
    "conservation" VARCHAR(255),
    "label_name" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_labeling_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_labels" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "conservation" VARCHAR(255),
    "manipulated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "shelf_life_minutes" INTEGER NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "operator_user_id" TEXT,
    "operator_name" TEXT,
    "print_status" TEXT NOT NULL DEFAULT 'requested',
    "print_error" TEXT,
    "printed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "food_labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_labeling_configs_item_id_unique" ON "item_labeling_configs"("item_id");
CREATE INDEX "item_labeling_configs_enabled_idx" ON "item_labeling_configs"("enabled");
CREATE INDEX "food_labels_created_at_idx" ON "food_labels"("created_at");
CREATE INDEX "food_labels_item_created_at_idx" ON "food_labels"("item_id", "created_at");
CREATE INDEX "food_labels_status_created_at_idx" ON "food_labels"("print_status", "created_at");
ALTER TABLE "item_labeling_configs" ADD CONSTRAINT "item_labeling_configs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_labels" ADD CONSTRAINT "food_labels_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
