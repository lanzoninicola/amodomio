-- AlterTable: rename cost columns on stock_movements for explicit timing semantics
ALTER TABLE "stock_movements" RENAME COLUMN "previous_cost_amount" TO "last_cost_at_import";
ALTER TABLE "stock_movements" RENAME COLUMN "previous_cost_unit"   TO "last_cost_unit_at_import";
ALTER TABLE "stock_movements" RENAME COLUMN "new_cost_amount"      TO "new_cost_at_import";
ALTER TABLE "stock_movements" RENAME COLUMN "new_cost_unit"        TO "new_cost_unit_at_import";
ALTER TABLE "stock_movements" ADD COLUMN    "avg_cost_at_import"   DOUBLE PRECISION;
