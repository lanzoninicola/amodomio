/*
  Warnings:

  - You are about to drop the `import_mogo_venda_por_cliente` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "import_mogo_venda_por_cliente";

-- CreateTable
CREATE TABLE "import_mogo_vendas_por_cliente" (
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

    CONSTRAINT "import_mogo_vendas_por_cliente_pkey" PRIMARY KEY ("id")
);
