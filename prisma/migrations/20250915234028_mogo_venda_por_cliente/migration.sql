-- CreateTable
CREATE TABLE "mogo_venda_por_cliente" (
    "id" TEXT NOT NULL,
    "order_number" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "customer_name" TEXT NOT NULL,
    "payment_type" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "table_label" TEXT,
    "order_tag" TEXT,
    "phone" TEXT,
    "raw_date" TEXT,
    "raw_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mogo_venda_por_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_mogo_venda_por_cliente_order_number" ON "mogo_venda_por_cliente"("order_number");

-- CreateIndex
CREATE INDEX "idx_mogo_venda_por_cliente_customer_name" ON "mogo_venda_por_cliente"("customer_name");

-- CreateIndex
CREATE INDEX "idx_mogo_venda_por_cliente_phone" ON "mogo_venda_por_cliente"("phone");

-- CreateIndex
CREATE INDEX "idx_mogo_venda_por_cliente_paid_at" ON "mogo_venda_por_cliente"("paid_at");
