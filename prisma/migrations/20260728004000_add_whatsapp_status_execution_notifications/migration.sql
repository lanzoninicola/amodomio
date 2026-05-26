ALTER TABLE "whatsapp_status_publication_executions"
  ADD COLUMN IF NOT EXISTS "notification_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "notification_status" TEXT,
  ADD COLUMN IF NOT EXISTS "notification_error" TEXT,
  ADD COLUMN IF NOT EXISTS "notification_sent_at" TIMESTAMP(3);
