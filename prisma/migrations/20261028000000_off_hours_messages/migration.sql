-- CreateTable
CREATE TABLE "off_hours_messages" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "response_type" TEXT NOT NULL DEFAULT 'text',
    "message" TEXT NOT NULL DEFAULT '',
    "video" TEXT NOT NULL DEFAULT '',
    "video_caption" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "image_caption" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "off_hours_messages_pkey" PRIMARY KEY ("id")
);

-- Apenas uma mensagem ativa por vez
CREATE UNIQUE INDEX "uq_off_hours_messages_single_active" ON "off_hours_messages" ("is_active") WHERE "is_active" = true;

-- Backfill: converte a configuração atual (settings) na primeira mensagem, ativa
INSERT INTO "off_hours_messages" ("id", "label", "response_type", "message", "video", "video_caption", "is_active", "updated_at")
SELECT
  gen_random_uuid()::text,
  'Mensagem atual',
  CASE WHEN lower(coalesce(max(CASE WHEN name = 'off-hours-response-type' THEN value END), 'text')) = 'video' THEN 'video' ELSE 'text' END,
  coalesce(max(CASE WHEN name = 'off-hours-message' THEN value END), 'Estamos fora do horário. Voltamos em breve! 🍕'),
  coalesce(max(CASE WHEN name = 'off-hours-video' THEN value END), ''),
  coalesce(max(CASE WHEN name = 'off-hours-video-caption' THEN value END), ''),
  true,
  CURRENT_TIMESTAMP
FROM "settings"
WHERE context = 'store-opening-hours';
