CREATE TABLE "suitable_order_inbox" (
    "id" TEXT NOT NULL,
    "suitable_order_id" INTEGER NOT NULL,
    "last_event_id" TEXT,
    "last_event_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB,
    "fetch_error" TEXT,
    "imported_row_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suitable_order_inbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "suitable_order_inbox_suitable_order_id_key" ON "suitable_order_inbox"("suitable_order_id");
CREATE INDEX "suitable_order_inbox_status_created_at_idx" ON "suitable_order_inbox"("status", "created_at");

CREATE TABLE "suitable_webhook_event" (
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suitable_webhook_event_pkey" PRIMARY KEY ("event_id")
);
