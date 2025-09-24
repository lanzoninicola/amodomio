-- CreateTable
CREATE TABLE "nlp_intent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nlp_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nlp_utterance" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt',
    "intent_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nlp_utterance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nlp_entity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nlp_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nlp_entity_example" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "synonyms" TEXT[],
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nlp_entity_example_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nlp_model" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'pt',
    "artifact" JSONB NOT NULL,
    "trained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nlp_model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nlp_intent_name_key" ON "nlp_intent"("name");

-- CreateIndex
CREATE UNIQUE INDEX "nlp_entity_name_key" ON "nlp_entity"("name");

-- AddForeignKey
ALTER TABLE "nlp_utterance" ADD CONSTRAINT "nlp_utterance_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "nlp_intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nlp_entity_example" ADD CONSTRAINT "nlp_entity_example_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "nlp_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
