CREATE TABLE "item_likes" (
  "id" TEXT NOT NULL,
  "item_id" TEXT,
  "session_id" TEXT,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "item_likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_shares" (
  "id" TEXT NOT NULL,
  "item_id" TEXT,
  "session_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_shares_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_interest_events" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "client_id" TEXT,
  "type" VARCHAR NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "item_interest_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "item_interest_events_item_id_type_created_at_idx"
ON "item_interest_events"("item_id", "type", "created_at");

CREATE INDEX "item_interest_events_client_id_idx"
ON "item_interest_events"("client_id");

ALTER TABLE "item_likes"
ADD CONSTRAINT "item_likes_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_likes"
ADD CONSTRAINT "item_likes_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_shares"
ADD CONSTRAINT "item_shares_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_shares"
ADD CONSTRAINT "item_shares_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "item_interest_events"
ADD CONSTRAINT "item_interest_events_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
