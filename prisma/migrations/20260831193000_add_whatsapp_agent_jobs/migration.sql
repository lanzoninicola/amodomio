CREATE TABLE "whatsapp_agent_jobs" (
    "id" TEXT NOT NULL,
    "external_id" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "customer_id" TEXT,
    "inbound_text" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "response_text" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" VARCHAR(120),
    "last_error" TEXT,
    "sent_message_id" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_agent_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_agent_jobs_external_id_key"
    ON "whatsapp_agent_jobs"("external_id");

CREATE INDEX "whatsapp_agent_jobs_status_available_at_idx"
    ON "whatsapp_agent_jobs"("status", "available_at");

CREATE INDEX "whatsapp_agent_jobs_phone_created_at_idx"
    ON "whatsapp_agent_jobs"("phone", "created_at");

INSERT INTO "settings" ("id", "context", "name", "type", "value", "created_at", "updated_at")
SELECT gen_random_uuid()::text, defaults.context, defaults.name, defaults.type, defaults.value, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
    ('whatsapp-ai-agent', 'enabled', 'boolean', 'false'),
    ('whatsapp-ai-agent', 'mode', 'string', 'test'),
    ('whatsapp-ai-agent', 'testPhone', 'string', ''),
    ('whatsapp-ai-agent', 'provider', 'string', 'openrouter'),
    ('whatsapp-ai-agent', 'model', 'string', 'openrouter/free'),
    ('whatsapp-ai-agent', 'pollIntervalMs', 'int', '2000'),
    ('whatsapp-ai-agent', 'lockSeconds', 'int', '120'),
    ('whatsapp-ai-agent', 'maxAttempts', 'int', '5'),
    ('whatsapp-ai-agent', 'historyLimit', 'int', '8'),
    ('whatsapp-ai-agent', 'maxJobAgeMinutes', 'int', '15'),
    ('whatsapp-ai-agent', 'businessInstructions', 'string', '')
) AS defaults(context, name, type, value)
WHERE NOT EXISTS (
    SELECT 1
    FROM "settings" existing
    WHERE existing."context" = defaults.context
      AND existing."name" = defaults.name
);
