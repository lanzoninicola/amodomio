/*
  Warnings:

  - You are about to drop the `kds_order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kds_order_day` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "kds_order" DROP CONSTRAINT "kds_order_kds_order_day_id_fkey";

-- DropForeignKey
ALTER TABLE "kds_order_day" DROP CONSTRAINT "kds_order_day_calendar_day_id_fkey";

-- DropTable
DROP TABLE "kds_order";

-- DropTable
DROP TABLE "kds_order_day";

-- CreateTable
CREATE TABLE "kds_orders" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "date_int" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kds_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kds_orders_details" (
    "id" TEXT NOT NULL,
    "kds_order_id" TEXT NOT NULL,
    "command_number" INTEGER NOT NULL,
    "product" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "has_moto" BOOLEAN NOT NULL DEFAULT false,
    "moto_value" DECIMAL(65,30) NOT NULL,
    "channel" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kds_orders_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kds_orders_date_key" ON "kds_orders"("date");

-- CreateIndex
CREATE UNIQUE INDEX "kds_orders_date_int_key" ON "kds_orders"("date_int");

-- CreateIndex
CREATE INDEX "kds_orders_date_int_idx" ON "kds_orders"("date_int");

-- CreateIndex
CREATE INDEX "kds_orders_details_kds_order_id_idx" ON "kds_orders_details"("kds_order_id");

-- CreateIndex
CREATE INDEX "kds_orders_details_command_number_idx" ON "kds_orders_details"("command_number");

-- CreateIndex
CREATE INDEX "kds_orders_details_channel_idx" ON "kds_orders_details"("channel");

-- AddForeignKey
ALTER TABLE "kds_orders_details" ADD CONSTRAINT "kds_orders_details_kds_order_id_fkey" FOREIGN KEY ("kds_order_id") REFERENCES "kds_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
