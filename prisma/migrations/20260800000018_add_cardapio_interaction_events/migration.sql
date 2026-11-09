CREATE TABLE "cardapio_interaction_events" (
    "id" TEXT NOT NULL,
    "event_name" VARCHAR(64) NOT NULL,
    "control" VARCHAR(32) NOT NULL,
    "value" VARCHAR(120) NOT NULL,
    "placement" VARCHAR(32) NOT NULL,
    "client_id" VARCHAR(120),
    "path" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardapio_interaction_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cardapio_interaction_events_event_name_created_at_idx"
ON "cardapio_interaction_events"("event_name", "created_at");

CREATE INDEX "cardapio_interaction_events_control_value_created_at_idx"
ON "cardapio_interaction_events"("control", "value", "created_at");

CREATE INDEX "cardapio_interaction_events_client_id_created_at_idx"
ON "cardapio_interaction_events"("client_id", "created_at");
