-- CreateEnum
CREATE TYPE "FacebookPixelIntegrationMode" AS ENUM ('direct', 'gtm');

-- CreateTable
CREATE TABLE "cardapio_facebook_pixel_configs" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'cardapio',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "FacebookPixelIntegrationMode" NOT NULL DEFAULT 'direct',
    "pixel_id" TEXT,
    "gtm_container_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardapio_facebook_pixel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardapio_facebook_pixel_events" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "payload_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardapio_facebook_pixel_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cardapio_facebook_pixel_configs_scope_key" ON "cardapio_facebook_pixel_configs"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "cardapio_facebook_pixel_events_config_id_event_key_key" ON "cardapio_facebook_pixel_events"("config_id", "event_key");

-- CreateIndex
CREATE INDEX "cardapio_facebook_pixel_events_config_id_trigger_idx" ON "cardapio_facebook_pixel_events"("config_id", "trigger");

-- AddForeignKey
ALTER TABLE "cardapio_facebook_pixel_events"
ADD CONSTRAINT "cardapio_facebook_pixel_events_config_id_fkey"
FOREIGN KEY ("config_id") REFERENCES "cardapio_facebook_pixel_configs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
