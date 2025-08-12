/*
  Warnings:

  - You are about to drop the `kds_orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "kds_orders" DROP CONSTRAINT "kds_orders_bairroId_fkey";

-- DropTable
DROP TABLE "kds_orders";

-- CreateTable
CREATE TABLE "kds_daily_orders" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "date_int" INTEGER NOT NULL,
    "tot_orders_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kds_daily_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kds_daily_order_details" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "date_int" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "command_number" INTEGER NOT NULL,
    "size" TEXT,
    "has_moto" BOOLEAN NOT NULL DEFAULT false,
    "moto_value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "order_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "channel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'novoPedido',
    "bairro_id" TEXT,

    CONSTRAINT "kds_daily_order_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kds_daily_orders_date_int_idx" ON "kds_daily_orders"("date_int");

-- CreateIndex
CREATE UNIQUE INDEX "kds_daily_orders_date_int_key" ON "kds_daily_orders"("date_int");

-- CreateIndex
CREATE INDEX "kds_daily_order_details_date_int_idx" ON "kds_daily_order_details"("date_int");

-- CreateIndex
CREATE INDEX "kds_daily_order_details_command_number_idx" ON "kds_daily_order_details"("command_number");

-- CreateIndex
CREATE INDEX "kds_daily_order_details_order_id_idx" ON "kds_daily_order_details"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "kds_daily_order_details_date_int_command_number_key" ON "kds_daily_order_details"("date_int", "command_number");

-- AddForeignKey
ALTER TABLE "kds_daily_order_details" ADD CONSTRAINT "kds_daily_order_details_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "kds_daily_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kds_daily_order_details" ADD CONSTRAINT "kds_daily_order_details_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
