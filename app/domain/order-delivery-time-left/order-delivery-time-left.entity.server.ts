import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MogoBaseOrder } from "../mogo/types";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import prismaClient from "~/lib/prisma/client.server";
import { SettingOptionModel } from "../setting/setting.option.model.server";

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
        createdAt: new Date(),
        updatedAt: new Date(),
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

  async getUpdatedCountersMassa(openedOrders: MogoBaseOrder[]) {
    const stockMassaFamiliaSetting = await SettingOptionModel.factory(
      "massaFamilia"
    );
    const stockMassaMediaSetting = await SettingOptionModel.factory(
      "massaMedia"
    );

    const stockAmountMassaFamilia = stockMassaFamiliaSetting?.value || 0;
    const stockAmountMassaMedia = stockMassaMediaSetting?.value || 0;

    let totMassaFamilia = 0;
    let totMassaMedia = 0;

    openedOrders.forEach((o) => {
      o.Itens.forEach((i) => {
        if (i.IdProduto === 19) {
          totMassaFamilia = totMassaFamilia + 1;
        }

        if (i.IdProduto === 18) {
          totMassaMedia = totMassaMedia + 1;
        }
      });
    });

    return {
      stockAmountMassaFamilia: stockAmountMassaFamilia - totMassaFamilia,
      stockAmountMassaMedia: stockAmountMassaMedia - totMassaMedia,
    };
  }
}

const ordersDeliveryTimeLeftEntity = new OrdersDeliveryTimeLeftEntity({
  client: prismaClient,
});

export { ordersDeliveryTimeLeftEntity };
