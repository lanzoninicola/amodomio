CREATE TYPE "ItemSellingVisibilityDisableBatchStatus" AS ENUM ('open', 'sent');

CREATE TABLE "item_selling_visibility_disable_batches" (
    "id" TEXT NOT NULL,
    "operator_user_id" TEXT,
    "operator_session_id" TEXT,
    "status" "ItemSellingVisibilityDisableBatchStatus" NOT NULL DEFAULT 'open',
    "recipient_user_id" TEXT,
    "recipient_phone" TEXT,
    "message_text" TEXT,
    "sent_at" TIMESTAMP(3),
    "zapi_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_selling_visibility_disable_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_selling_visibility_disable_batch_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_selling_channel_id" TEXT NOT NULL,
    "previous_visible" BOOLEAN NOT NULL,
    "next_visible" BOOLEAN NOT NULL DEFAULT false,
    "item_name_snapshot" TEXT NOT NULL,
    "channel_name_snapshot" TEXT NOT NULL,
    "menu_engineering_tag_snapshot" TEXT,
    "reference_variation_name_snapshot" TEXT,
    "reference_price_amount" DOUBLE PRECISION,
    "reference_cost_percentage" DOUBLE PRECISION,
    "reference_profit_percentage" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_selling_visibility_disable_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_selling_visibility_disable_batches_session_status_idx" ON "item_selling_visibility_disable_batches"("operator_session_id", "status", "updated_at");
CREATE INDEX "item_selling_visibility_disable_batches_user_status_idx" ON "item_selling_visibility_disable_batches"("operator_user_id", "status", "updated_at");
CREATE INDEX "item_selling_visibility_disable_batches_status_idx" ON "item_selling_visibility_disable_batches"("status", "updated_at");

CREATE UNIQUE INDEX "item_selling_visibility_disable_batch_items_unique" ON "item_selling_visibility_disable_batch_items"("batch_id", "item_id", "item_selling_channel_id");
CREATE INDEX "item_selling_visibility_disable_batch_items_item_id_idx" ON "item_selling_visibility_disable_batch_items"("item_id");
CREATE INDEX "item_selling_visibility_disable_batch_items_channel_id_idx" ON "item_selling_visibility_disable_batch_items"("item_selling_channel_id");

ALTER TABLE "item_selling_visibility_disable_batch_items"
ADD CONSTRAINT "item_selling_visibility_disable_batch_items_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "item_selling_visibility_disable_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
