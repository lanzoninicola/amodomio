/*
  Warnings:

  - You are about to drop the `item_cost_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "item_cost_history" DROP CONSTRAINT "item_cost_history_item_id_fkey";

-- DropTable
DROP TABLE "item_cost_history";
