-- CreateTable
CREATE TABLE "crm_customer" (
    "id" TEXT NOT NULL,
    "phone_e164" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_tag" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_tag_link" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_tag_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_event" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "source" VARCHAR(100),
    "external_id" VARCHAR(150),
    "payload" JSONB,
    "payload_raw" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_campaign" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source" VARCHAR(100),
    "external_id" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_campaign_send" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" VARCHAR(50),
    "payload" JSONB,
    "payload_raw" TEXT,
    "source" VARCHAR(100),
    "external_id" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_campaign_send_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_phone_e164_key" ON "crm_customer"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_tag_key_key" ON "crm_customer_tag"("key");

-- CreateIndex
CREATE INDEX "crm_customer_tag_link_tag_id_idx" ON "crm_customer_tag_link"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customer_tag_link_customer_id_tag_id_key" ON "crm_customer_tag_link"("customer_id", "tag_id");

-- CreateIndex
CREATE INDEX "crm_customer_event_customer_id_idx" ON "crm_customer_event"("customer_id");

-- CreateIndex
CREATE INDEX "crm_customer_event_source_external_id_idx" ON "crm_customer_event"("source", "external_id");

-- CreateIndex
CREATE INDEX "crm_campaign_send_campaign_id_idx" ON "crm_campaign_send"("campaign_id");

-- CreateIndex
CREATE INDEX "crm_campaign_send_customer_id_idx" ON "crm_campaign_send"("customer_id");

-- CreateIndex
CREATE INDEX "crm_campaign_send_source_external_id_idx" ON "crm_campaign_send"("source", "external_id");

-- AddForeignKey
ALTER TABLE "crm_customer_tag_link" ADD CONSTRAINT "crm_customer_tag_link_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_tag_link" ADD CONSTRAINT "crm_customer_tag_link_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "crm_customer_tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_event" ADD CONSTRAINT "crm_customer_event_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campaign_send" ADD CONSTRAINT "crm_campaign_send_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campaign_send" ADD CONSTRAINT "crm_campaign_send_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
