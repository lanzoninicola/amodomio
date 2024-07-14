-- CreateTable
CREATE TABLE "mogo_orders_inbound" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "order_date_str" TEXT NOT NULL,
    "order_time_str" TEXT NOT NULL,
    "raw_data" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mogo_orders_inbound_pkey" PRIMARY KEY ("id")
);
