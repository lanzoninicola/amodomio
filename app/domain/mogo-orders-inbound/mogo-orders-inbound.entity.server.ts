import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MogoBaseOrder } from "../mogo/types";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import prismaClient from "~/lib/prisma/client.server";
import { SettingOptionModel } from "../setting/setting.option.model.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import MogoOrdersInboundUtility from "./mogo-orders-inbound.utility.server";
import { format } from "node:path";

export interface MogoOrderInbound {
  id: string;
  orderNumber: string;
  orderDateStr: string | null;
  orderTimeStr: string | null;
  rawData: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class MogoOrdersInboundEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async trackOrder(order: MogoBaseOrder) {
    const [err, record] = await prismaIt(
      this.client.mogoOrdersInbound.findFirst({
        where: {
          orderNumber: order.NumeroPedido,
          archivedAt: null,
        },
      })
    );

    if (err) return;

    if (record) return;

    await this.client.mogoOrdersInbound.create({
      data: {
        orderNumber: order.NumeroPedido,
        orderDateStr: order.DataPedido,
        orderTimeStr: order.HoraPedido,
        rawData: jsonStringify(order),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async getActiveTrackedOrders() {
    return await this.client.mogoOrdersInbound.findMany({
      where: {
        archivedAt: null,
      },
    });
  }

  async archiveActiveRecords() {
    return await this.client.mogoOrdersInbound.updateMany({
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

  async findAll(): Promise<MogoOrderInbound[]> {
    const [err, records] = await prismaIt(
      this.client.mogoOrdersInbound.findMany()
    );

    if (err) return [];

    return records;
  }

  async findByDate(date: string): Promise<MogoOrderInbound[]> {
    const [err, records] = await prismaIt(
      this.client.mogoOrdersInbound.findMany({
        where: {
          orderDateStr: {
            equals: MogoOrdersInboundUtility.formatDate(date),
          },
        },
      })
    );
    if (err) return [];

    return records;
  }
}

const mogoOrdersInboundEntity = new MogoOrdersInboundEntity({
  client: prismaClient,
});

export { mogoOrdersInboundEntity };
