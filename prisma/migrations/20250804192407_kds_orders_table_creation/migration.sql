-- CreateTable
CREATE TABLE "kds_order_day" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "date_int" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calendar_day_id" TEXT,

    CONSTRAINT "kds_order_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kds_order" (
    "id" TEXT NOT NULL,
    "kds_order_day_id" TEXT NOT NULL,
    "command_number" INTEGER NOT NULL,
    "product" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "has_moto" BOOLEAN NOT NULL DEFAULT false,
    "moto_value" DECIMAL(65,30) NOT NULL,
    "channel" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kds_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kds_order_day_date_key" ON "kds_order_day"("date");

-- CreateIndex
CREATE UNIQUE INDEX "kds_order_day_date_int_key" ON "kds_order_day"("date_int");

-- CreateIndex
CREATE INDEX "kds_order_day_date_int_idx" ON "kds_order_day"("date_int");

-- CreateIndex
CREATE INDEX "kds_order_kds_order_day_id_idx" ON "kds_order"("kds_order_day_id");

-- CreateIndex
CREATE INDEX "kds_order_command_number_idx" ON "kds_order"("command_number");

-- CreateIndex
CREATE INDEX "kds_order_channel_idx" ON "kds_order"("channel");

-- AddForeignKey
ALTER TABLE "kds_order_day" ADD CONSTRAINT "kds_order_day_calendar_day_id_fkey" FOREIGN KEY ("calendar_day_id") REFERENCES "calendar_day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kds_order" ADD CONSTRAINT "kds_order_kds_order_day_id_fkey" FOREIGN KEY ("kds_order_day_id") REFERENCES "kds_order_day"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
