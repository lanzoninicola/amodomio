CREATE TABLE "meta_ads_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "correlation_id" TEXT,
    "event" TEXT,
    "phone" TEXT,
    "trigger" TEXT,
    "message_text" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "response_type" TEXT,
    "payload_preview" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_ads_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meta_ads_logs_event_idx" ON "meta_ads_logs"("event");
CREATE INDEX "meta_ads_logs_created_at_idx" ON "meta_ads_logs"("created_at");
