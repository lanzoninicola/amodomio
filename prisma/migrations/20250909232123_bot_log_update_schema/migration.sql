-- CreateEnum
CREATE TYPE "BotResponderEngine" AS ENUM ('MANUAL', 'NLP');

-- AlterTable
ALTER TABLE "bot_auto_responder_logs" ADD COLUMN     "engine" TEXT,
ADD COLUMN     "intent" TEXT,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "session" TEXT;

-- CreateIndex
CREATE INDEX "idx_bot_auto_responder_logs_intent" ON "bot_auto_responder_logs"("intent");

-- CreateIndex
CREATE INDEX "idx_bot_auto_responder_logs_engine_created" ON "bot_auto_responder_logs"("engine", "created_at");
