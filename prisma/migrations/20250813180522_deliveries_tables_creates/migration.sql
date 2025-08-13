-- AlterTable
ALTER TABLE "kds_daily_order_details" ADD COLUMN     "bairroId" TEXT;

-- CreateTable
CREATE TABLE "bairros" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bairros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip_code" TEXT,
    "phone_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "main_location" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "company_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zone_distance" (
    "id" TEXT NOT NULL,
    "bairro_id" TEXT NOT NULL,
    "company_location_id" TEXT NOT NULL,
    "distance_in_km" DOUBLE PRECISION NOT NULL,
    "estimated_time_in_min" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_zone_distance_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "delivery_riders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "base_fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "delivery_riders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zone_distance_bairro_id_company_location_id_key" ON "delivery_zone_distance"("bairro_id", "company_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_fees_bairro_id_pizzeria_location_id_key" ON "delivery_fees"("bairro_id", "pizzeria_location_id");

-- AddForeignKey
ALTER TABLE "kds_daily_order_details" ADD CONSTRAINT "kds_daily_order_details_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES "bairros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zone_distance" ADD CONSTRAINT "delivery_zone_distance_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zone_distance" ADD CONSTRAINT "delivery_zone_distance_company_location_id_fkey" FOREIGN KEY ("company_location_id") REFERENCES "company_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fees" ADD CONSTRAINT "delivery_fees_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fees" ADD CONSTRAINT "delivery_fees_pizzeria_location_id_fkey" FOREIGN KEY ("pizzeria_location_id") REFERENCES "company_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
