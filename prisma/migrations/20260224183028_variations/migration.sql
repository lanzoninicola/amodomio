-- CreateTable
CREATE TABLE "variations" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_variations" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "variation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "item_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_cost_variations" (
    "id" TEXT NOT NULL,
    "item_variation_id" TEXT NOT NULL,
    "cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previous_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "source" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "item_cost_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_cost_variations_history" (
    "id" TEXT NOT NULL,
    "item_variation_id" TEXT NOT NULL,
    "cost_amount" DOUBLE PRECISION NOT NULL,
    "previous_cost_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "source" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_cost_variations_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variations_kind_idx" ON "variations"("kind");

-- CreateIndex
CREATE INDEX "variations_deleted_at_idx" ON "variations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "variations_kind_code_unique" ON "variations"("kind", "code");

-- CreateIndex
CREATE INDEX "item_variations_item_id_idx" ON "item_variations"("item_id");

-- CreateIndex
CREATE INDEX "item_variations_variation_id_idx" ON "item_variations"("variation_id");

-- CreateIndex
CREATE INDEX "item_variations_deleted_at_idx" ON "item_variations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "item_variations_item_variation_unique" ON "item_variations"("item_id", "variation_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_cost_variations_item_variation_id_unique" ON "item_cost_variations"("item_variation_id");

-- CreateIndex
CREATE INDEX "item_cost_variations_valid_from_idx" ON "item_cost_variations"("valid_from");

-- CreateIndex
CREATE INDEX "item_cost_variations_source_ref_idx" ON "item_cost_variations"("source", "reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "item_cost_variations_deleted_at_idx" ON "item_cost_variations"("deleted_at");

-- CreateIndex
CREATE INDEX "item_cost_variation_history_item_variation_valid_from_idx" ON "item_cost_variations_history"("item_variation_id", "valid_from");

-- CreateIndex
CREATE INDEX "item_cost_variation_history_item_variation_created_at_idx" ON "item_cost_variations_history"("item_variation_id", "created_at");

-- CreateIndex
CREATE INDEX "item_cost_variation_history_source_ref_idx" ON "item_cost_variations_history"("source", "reference_type", "reference_id");

-- AddForeignKey
ALTER TABLE "item_variations" ADD CONSTRAINT "item_variations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_variations" ADD CONSTRAINT "item_variations_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "variations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_cost_variations" ADD CONSTRAINT "item_cost_variations_item_variation_id_fkey" FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_cost_variations_history" ADD CONSTRAINT "item_cost_variations_history_item_variation_id_fkey" FOREIGN KEY ("item_variation_id") REFERENCES "item_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
