/*
  Warnings:

  - You are about to drop the `delivery_fee` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "delivery_fee" DROP CONSTRAINT "delivery_fee_bairro_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_fee" DROP CONSTRAINT "delivery_fee_pizzeria_location_id_fkey";

-- DropTable
DROP TABLE "delivery_fee";

-- CreateTable
CREATE TABLE "delivery_fees" (
    "id" TEXT NOT NULL,
    "bairro_id" TEXT NOT NULL,
    "pizzeria_location_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_fees_bairro_id_pizzeria_location_id_key" ON "delivery_fees"("bairro_id", "pizzeria_location_id");

-- AddForeignKey
ALTER TABLE "delivery_fees" ADD CONSTRAINT "delivery_fees_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fees" ADD CONSTRAINT "delivery_fees_pizzeria_location_id_fkey" FOREIGN KEY ("pizzeria_location_id") REFERENCES "pizzeria_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
