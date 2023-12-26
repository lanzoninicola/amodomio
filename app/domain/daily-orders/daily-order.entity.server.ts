import randomReactKey from "~/utils/random-react-key";
import { BaseEntity } from "../base.entity";
import {
  DailyOrder,
  DailyOrderModel,
  DailyOrderTransaction,
} from "./daily-order.model.server";
import { nowWithTime } from "~/lib/dayjs";
import { serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

class DailyOrderEntity extends BaseEntity<DailyOrder> {
  async createDailyOrder(dailyOrder: DailyOrder) {
    const dateToAdd = dailyOrder.date;

    const records = await DailyOrderModel.findWhere("date", "==", dateToAdd);

    if (records.length === 0) {
      return;
    }

    this.create(dailyOrder);
  }

  async findAllLimit(limit: number) {
    const dailyOrders = await DailyOrderModel.findAll();

    return dailyOrders.slice(0, limit);
  }

  async findAllTransactions(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);

    const records = dailyOrder?.transactions.filter(
      (t) => t.deletedAt === null
    );

    return records || [];
  }

  async createTransaction(
    id: DailyOrder["id"],
    transaction: DailyOrderTransaction
  ) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);

    if (!dailyOrder) return;

    const transactions = dailyOrder?.transactions || [];
    const transactionId = randomReactKey();
    transactions.push({ ...transaction, id: transactionId });

    if (transaction.product === "Pizza Familía") {
      dailyOrder.restLargePizzaNumber = dailyOrder.restLargePizzaNumber - 1;
    }

    if (transaction.product === "Pizza Média") {
      dailyOrder.restMediumPizzaNumber = dailyOrder.restMediumPizzaNumber - 1;
    }

    const [err, itemUpdated] = await tryit(
      this.update(id, {
        ...dailyOrder,
        totalOrdersNumber: dailyOrder.totalOrdersNumber + 1,
        totalOrdersAmount: dailyOrder.totalOrdersAmount + transaction.amount,
        totalMotoboyAmount:
          dailyOrder.totalMotoboyAmount + transaction.amountMotoboy,
        transactions,
      })
    );

    if (err) {
      return serverError({ message: err.message });
    }
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

    if (!dailyOrder) {
      return;
    }

    const transactions = dailyOrder?.transactions || [];
    const index = transactions.findIndex((t) => t.id === transactionId);
    if (index === -1) return;
    const deletedTransaction = {
      ...transactions[index],
      deletedAt: nowWithTime(),
    };

    transactions[index] = deletedTransaction;

    const [err, itemUpdated] = await tryit(
      this.update(id, {
        ...dailyOrder,
        totalOrdersNumber: dailyOrder.totalOrdersNumber - 1,
        totalOrdersAmount:
          dailyOrder.totalOrdersAmount + transactions[index].amount,
        totalMotoboyAmount:
          dailyOrder.totalMotoboyAmount + transactions[index].amountMotoboy,
        transactions,
      })
    );
  }

  async decreaseLargePizzaNumber(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const restLargePizzaNumber = dailyOrder?.restLargePizzaNumber || 0;

    await this.update(id, { restLargePizzaNumber: restLargePizzaNumber - 1 });
  }

  async increaseLargePizzaNumber(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const restLargePizzaNumber = dailyOrder?.restLargePizzaNumber || 0;

    await this.update(id, { restLargePizzaNumber: restLargePizzaNumber + 1 });
  }

  async decreaseMediumPizzaNumber(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const restMediumPizzaNumber = dailyOrder?.restMediumPizzaNumber || 0;

    await this.update(id, { restMediumPizzaNumber: restMediumPizzaNumber - 1 });
  }

  async increaseMediumPizzaNumber(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const restMediumPizzaNumber = dailyOrder?.restMediumPizzaNumber || 0;

    await this.update(id, { restMediumPizzaNumber: restMediumPizzaNumber + 1 });
  }

  async findDailyOrderByDate(date: DailyOrder["date"]) {
    const dailyOrders = await DailyOrderModel.findWhere("date", "==", date);

    return dailyOrders[0];
  }

  async increaseTotalMotoboyAmount(id: DailyOrder["id"], amount: number) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const totalMotoboyAmount = dailyOrder?.totalMotoboyAmount || 0;

    await this.update(id, { totalMotoboyAmount: totalMotoboyAmount + amount });
  }

  async decreaseTotalMotoboyAmount(id: DailyOrder["id"], amount: number) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const totalMotoboyAmount = dailyOrder?.totalMotoboyAmount || 0;

    await this.update(id, { totalMotoboyAmount: totalMotoboyAmount - amount });
  }

  async increaseTotalOrdersAmount(id: DailyOrder["id"], amount: number) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const totalOrdersAmount = dailyOrder?.totalOrdersAmount || 0;

    await this.update(id, { totalAmount: totalOrdersAmount + amount });
  }

  async decreaseTotalOrdersAmount(id: DailyOrder["id"], amount: number) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const totalOrdersAmount = dailyOrder?.totalOrdersAmount || 0;

    await this.update(id, { totalAmount: totalOrdersAmount - amount });
  }

  async increaseTotalOrdersNumber(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const totalOrdersNumber = dailyOrder?.totalOrdersNumber || 0;

    await this.update(id, { totalOrdersNumber: totalOrdersNumber + 1 } || 0);
  }

  async decreaseTotalOrdersNumber(id: DailyOrder["id"]) {
    if (!id) return;

    const dailyOrder: DailyOrder | null = await this.findById(id);
    const totalOrdersNumber = dailyOrder?.totalOrdersNumber || 0;

    await this.update(id, { totalOrdersNumber: totalOrdersNumber - 1 } || 0);
  }
}

const dailyOrderEntity = new DailyOrderEntity(DailyOrderModel);

export { dailyOrderEntity };
