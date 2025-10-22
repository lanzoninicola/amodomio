-- AlterTable
ALTER TABLE "kds_daily_order_details" ADD COLUMN     "aguardando_forno_at" TIMESTAMP(3),
ADD COLUMN     "assando_at" TIMESTAMP(3),
ADD COLUMN     "em_producao_at" TIMESTAMP(3),
ADD COLUMN     "finalizado_at" TIMESTAMP(3);
