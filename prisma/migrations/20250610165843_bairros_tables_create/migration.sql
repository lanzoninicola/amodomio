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
CREATE TABLE "pizzeria_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip_code" TEXT,
    "phone_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pizzeria_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distance_to_pizzeria" (
    "id" TEXT NOT NULL,
    "bairro_id" TEXT NOT NULL,
    "pizzeria_location_id" TEXT NOT NULL,
    "distance_in_km" DOUBLE PRECISION NOT NULL,
    "estimated_time_in_min" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distance_to_pizzeria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_fee" (
    "id" TEXT NOT NULL,
    "bairro_id" TEXT NOT NULL,
    "pizzeria_location_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_fee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "distance_to_pizzeria_bairro_id_pizzeria_location_id_key" ON "distance_to_pizzeria"("bairro_id", "pizzeria_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_fee_bairro_id_pizzeria_location_id_key" ON "delivery_fee"("bairro_id", "pizzeria_location_id");

-- AddForeignKey
ALTER TABLE "distance_to_pizzeria" ADD CONSTRAINT "distance_to_pizzeria_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distance_to_pizzeria" ADD CONSTRAINT "distance_to_pizzeria_pizzeria_location_id_fkey" FOREIGN KEY ("pizzeria_location_id") REFERENCES "pizzeria_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fee" ADD CONSTRAINT "delivery_fee_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fee" ADD CONSTRAINT "delivery_fee_pizzeria_location_id_fkey" FOREIGN KEY ("pizzeria_location_id") REFERENCES "pizzeria_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
