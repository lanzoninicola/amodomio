CREATE TABLE "ai_conversation_knowledge_candidates" (
    "id" TEXT NOT NULL,
    "fingerprint" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "category" VARCHAR(80) NOT NULL DEFAULT 'geral',
    "canonical_question" TEXT NOT NULL,
    "answer" TEXT,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "examples" JSONB NOT NULL,
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_knowledge_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_conversation_knowledge_candidates_fingerprint_key"
    ON "ai_conversation_knowledge_candidates"("fingerprint");

CREATE INDEX "ai_conversation_knowledge_candidates_status_count_idx"
    ON "ai_conversation_knowledge_candidates"("status", "occurrence_count");

CREATE INDEX "ai_conversation_knowledge_candidates_category_status_idx"
    ON "ai_conversation_knowledge_candidates"("category", "status");
