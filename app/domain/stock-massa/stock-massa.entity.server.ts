import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { SettingOptionModel } from "../setting/setting.option.model.server";
import {
  ISettingPrismaEntity,
  settingPrismaEntity,
} from "../setting/setting.prisma.entity.server";
import { Setting } from "@prisma/client";

export interface StockProduct {
  initial: number;
  current: number;
}

/**
 * NOTE:
 *
 * INITIAL STOCK from setting
 * CURRENT STOCK = INITIAL STOCK - (OUTBOUND - INBOUND) => from tracking order delivery time left
 */

class StockMassaLoaderEntity {
  #familia: StockProduct = {
    initial: 0,
    current: 0,
  };
  #media: StockProduct = {
    initial: 0,
    current: 0,
  };

  #settingContext: string = "stockMassa";

  #settingClient: ISettingPrismaEntity | undefined;

  #isLoaded: boolean = false;

  /**
   * 2024-07-13 At current date stock of "massa" is from setting
   */
  constructor({ settingClient }: { settingClient: ISettingPrismaEntity }) {
    this.#settingClient = settingClient;
  }

  async get(): Promise<{ familia: StockProduct; media: StockProduct }> {
    const stockMassaFamiliaSetting = await SettingOptionModel.factory(
      "massaFamilia"
    );
    const stockMassaMediaSetting = await SettingOptionModel.factory(
      "massaMedia"
    );

    return {
      familia: {
        initial: stockMassaFamiliaSetting?.value || 0,
        current: stockMassaFamiliaSetting?.value || 0,
      },

      media: {
        initial: stockMassaMediaSetting?.value || 0,
        current: stockMassaMediaSetting?.value || 0,
      },
    };
  }

  getInitialFamilia() {
    return this.#familia.initial;
  }

  getInitialMedia() {
    return this.#media.initial;
  }

  getCurrentFamilia() {
    return this.#familia.current;
  }

  getCurrentMedia() {
    return this.#media.current;
  }

  async initStockMassa({
    type,
    amount,
  }: {
    type: "familia" | "media";
    amount: number;
  }) {
    if (!this.#settingClient) {
      return;
    }

    const context = this.#settingContext;

    const stockAmountMassa = isNaN(Number(amount)) ? 0 : Number(amount);

    const massaSetting: Partial<Setting> = {
      context,
      name: type === "familia" ? "massaFamilia" : "massaMedia",
      type: "number",
      value: String(stockAmountMassa),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (type === "familia") {
      this.#familia.initial = stockAmountMassa;
    } else {
      this.#media.initial = stockAmountMassa;
    }

    return await this.#settingClient.updateOrCreate(massaSetting);
  }

  // TODO: implementar
  //   async getUpdatedStockMassa() {
  //     let totMassaFamiliaOut = 0;
  //     let totMassaMediaOut = 0;

  //     const records = await this.getActiveTrackedOrders();

  //     records.forEach((r) => {
  //       const o: MogoBaseOrder = jsonParse(r.rawData);

  //       o.Itens.forEach((i) => {
  //         if (i.IdProduto === 19) {
  //           totMassaFamiliaOut = totMassaFamiliaOut + 1;
  //         }

  //         if (i.IdProduto === 18) {
  //           totMassaMediaOut = totMassaMediaOut + 1;
  //         }
  //       });
  //     });

  //     return {
  //       initial: {
  //         massaFamilia: initialStockMassaFamilia,
  //         massaMedia: initialStockMassaMedia,
  //       },
  //       final: {
  //         massaFamilia: initialStockMassaFamilia - totMassaFamiliaOut,
  //         massaMedia: initialStockMassaMedia - totMassaMediaOut,
  //       },
  //     };
  //   }
}

const stockMassaLoader = new StockMassaLoaderEntity({
  settingClient: settingPrismaEntity,
});

export { stockMassaLoader };
