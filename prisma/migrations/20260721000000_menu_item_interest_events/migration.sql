CREATE TABLE IF NOT EXISTS "menu_item_interest_events" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "client_id" TEXT,
    "type" VARCHAR NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_interest_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "menu_item_interest_events_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "menu_item_interest_events_menu_item_id_type_created_at_idx" ON "menu_item_interest_events"("menu_item_id", "type", "created_at");
CREATE INDEX IF NOT EXISTS "menu_item_interest_events_client_id_idx" ON "menu_item_interest_events"("client_id");
