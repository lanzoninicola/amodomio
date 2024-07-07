import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MogoBaseOrder } from "../mogo/types";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import prismaClient from "~/lib/prisma/client.server";
import { SettingOptionModel } from "../setting/setting.option.model.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";

class OrdersDeliveryTimeLeftEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async trackOrder(order: MogoBaseOrder) {
    const [err, record] = await prismaIt(
      this.client.orderDeliveryTimeLeftOrdersInbound.findFirst({
        where: {
          orderNumber: order.NumeroPedido,
          archivedAt: null,
        },
      })
    );

    if (err) return;

    if (record) return;

    await this.client.orderDeliveryTimeLeftOrdersInbound.create({
      data: {
        orderNumber: order.NumeroPedido,
        rawData: jsonStringify(order),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async getActiveTrackedOrders() {
    return await this.client.orderDeliveryTimeLeftOrdersInbound.findMany({
      where: {
        archivedAt: null,
      },
    });
  }

  async archiveActiveRecords() {
    return await this.client.orderDeliveryTimeLeftOrdersInbound.updateMany({
      where: {
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async getUpdatedStockMassa() {
    const stockMassaFamiliaSetting = await SettingOptionModel.factory(
      "massaFamilia"
    );
    const stockMassaMediaSetting = await SettingOptionModel.factory(
      "massaMedia"
    );

    const initialStockMassaFamilia = stockMassaFamiliaSetting?.value || 0;
    const initialStockMassaMedia = stockMassaMediaSetting?.value || 0;

    let totMassaFamiliaOut = 0;
    let totMassaMediaOut = 0;

    const records = await this.getActiveTrackedOrders();

    records.forEach((r) => {
      const o: MogoBaseOrder = jsonParse(r.rawData);

      o.Itens.forEach((i) => {
        if (i.IdProduto === 19) {
          totMassaFamiliaOut = totMassaFamiliaOut + 1;
        }

        if (i.IdProduto === 18) {
          totMassaMediaOut = totMassaMediaOut + 1;
        }
      });
    });

    return {
      initial: {
        massaFamilia: initialStockMassaFamilia,
        massaMedia: initialStockMassaMedia,
      },
      final: {
        massaFamilia: initialStockMassaFamilia - totMassaFamiliaOut,
        massaMedia: initialStockMassaMedia - totMassaMediaOut,
      },
    };
  }
}

const ordersDeliveryTimeLeftEntity = new OrdersDeliveryTimeLeftEntity({
  client: prismaClient,
});

export { ordersDeliveryTimeLeftEntity };
