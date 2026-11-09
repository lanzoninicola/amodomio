-- CreateTable
CREATE TABLE "product_measurements" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "purchase_um" TEXT NOT NULL,
    "consumption_um" TEXT NOT NULL,
    "purchase_to_consumption_factor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_measurements_product_id_key" ON "product_measurements"("product_id");

-- AddForeignKey
ALTER TABLE "product_measurements"
ADD CONSTRAINT "product_measurements_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

