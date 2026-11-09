-- CreateTable
CREATE TABLE "crm_customer_image" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_customer_image_customer_id_idx" ON "crm_customer_image"("customer_id");

-- AddForeignKey
ALTER TABLE "crm_customer_image" ADD CONSTRAINT "crm_customer_image_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm_customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
