import randomReactKey from "~/utils/random-react-key";
import { BaseEntity } from "../base.entity";
import {
  DailyOrder,
  DailyOrderModel,
  DailyOrderTransaction,
} from "./daily-order.model.server";
import { nowWithTime } from "~/lib/dayjs";

class DailyOrderEntity extends BaseEntity<DailyOrder> {
  async findAllLimit(limit: number) {
    const dailyOrders = await DailyOrderModel.findAll();

    return dailyOrders.slice(0, limit);
  }

  async findAllTransactions(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);

    return dailyOrder?.transactions || [];
  }

  async createTransaction(
    id: DailyOrder["id"],
    transaction: DailyOrderTransaction
  ) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const transactions = dailyOrder?.transactions || [];
    const transactionId = randomReactKey();
    transactions.push({ ...transaction, id: transactionId });

    console.log("+++++++++++++createTransaction", transactions);
    await this.update(id, { transactions });
  }

  async updateTransaction(
    id: DailyOrder["id"],
    transactionId: DailyOrderTransaction["id"],
    transaction: DailyOrderTransaction
  ) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const transactions = dailyOrder?.transactions || [];
    const index = transactions.findIndex((t) => t.id === transactionId);
    if (index === -1) return;
    transactions[index] = transaction;
    await this.update(id, { transactions });
    return transactions[index];
  }

  async deleteTransaction(
    id: DailyOrder["id"],
    transactionId: DailyOrderTransaction["id"]
  ) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const transactions = dailyOrder?.transactions || [];
    const index = transactions.findIndex((t) => t.id === transactionId);
    if (index === -1) return;
    const deletedTransaction = {
      ...transactions[index],
      deletedAd: nowWithTime(),
    };

    this.updateTransaction(id, transactionId, deletedTransaction);
  }
}

const dailyOrderEntity = new DailyOrderEntity(DailyOrderModel);

export { dailyOrderEntity };
