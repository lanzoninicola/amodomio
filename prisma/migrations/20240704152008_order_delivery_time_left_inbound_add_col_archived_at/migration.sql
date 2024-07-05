-- CreateTable
CREATE TABLE "odtl_orders_inbound" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odtl_orders_inbound_pkey" PRIMARY KEY ("id")
);
