-- CreateTable
CREATE TABLE "bot_auto_response_rules" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "is_regex" BOOLEAN NOT NULL DEFAULT false,
    "response" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "active_from" TIMESTAMP(3),
    "active_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_auto_response_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_auto_responder_logs" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT,
    "matched_text" TEXT,
    "from_number" TEXT,
    "to_number" TEXT,
    "inbound_body" TEXT NOT NULL,
    "outbound_body" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_auto_responder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "business_start_hour" INTEGER NOT NULL DEFAULT 18,
    "business_end_hour" INTEGER NOT NULL DEFAULT 22,
    "business_days" TEXT NOT NULL DEFAULT '3,4,5,6,0',
    "off_hours_message" TEXT NOT NULL DEFAULT 'Estamos fora do horário. Voltamos em breve! 🍕',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_bot_auto_response_rules_active_priority" ON "bot_auto_response_rules"("is_active", "priority");

-- CreateIndex
CREATE INDEX "idx_bot_auto_responder_logs_rule_id" ON "bot_auto_responder_logs"("rule_id");

-- CreateIndex
CREATE INDEX "idx_bot_auto_responder_logs_created_at" ON "bot_auto_responder_logs"("created_at");

-- AddForeignKey
ALTER TABLE "bot_auto_responder_logs" ADD CONSTRAINT "bot_auto_responder_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "bot_auto_response_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
