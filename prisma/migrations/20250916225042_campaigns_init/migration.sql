-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "last_order_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'erp',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optouts" (
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optouts_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "send_logs" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "customer_id" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "wpp_message_id" TEXT,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wpp_events" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wpp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagements" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "first_optin_at" TIMESTAMP(3),
    "last_optout_at" TIMESTAMP(3),

    CONSTRAINT "engagements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "send_logs_phone_idx" ON "send_logs"("phone");

-- CreateIndex
CREATE INDEX "send_logs_customer_id_idx" ON "send_logs"("customer_id");

-- CreateIndex
CREATE INDEX "wpp_events_phone_idx" ON "wpp_events"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "engagements_phone_key" ON "engagements"("phone");

-- AddForeignKey
ALTER TABLE "optouts" ADD CONSTRAINT "optouts_phone_fkey" FOREIGN KEY ("phone") REFERENCES "customers"("phone") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "send_logs" ADD CONSTRAINT "send_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_phone_fkey" FOREIGN KEY ("phone") REFERENCES "customers"("phone") ON DELETE CASCADE ON UPDATE CASCADE;
