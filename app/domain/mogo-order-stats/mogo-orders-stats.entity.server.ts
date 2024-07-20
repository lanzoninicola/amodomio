import { jsonParse } from "~/utils/json-helper";
import { MogoBaseOrder } from "../mogo/types";
import { MogoOrderInbound } from "../mogo-orders-inbound/mogo-orders-inbound.entity.server";

export interface ResultadoStats {
  numberOfOrders: number;
  topThreeToppings: string[];
  sizesAmount: Record<string, number>;
  lastTopping: string;
}

export default class MogoOrderStatsEntity {
  #orders: MogoBaseOrder[] = [];

  constructor({ orders }: { orders: MogoOrderInbound[] }) {
    this.#orders = orders.map((o: MogoOrderInbound) =>
      jsonParse(o.rawData ?? "{}")
    );
  }

  resultado() {
    return {
      numberOfOrders: this.#numberOfOrders(),
      topThreeToppings: this.#topThreeToppings(),
      lastTopping: this.#lastTopping(),
      sizesAmount: this.#sizesAmount(),
    };
  }

  #numberOfOrders() {
    return this.#orders.length;
  }

  #sizesAmount() {
    const sizeCounts: Record<string, number> = {
      media: 0,
      familia: 0,
    };

    this.#orders.forEach((order) => {
      order.Itens.forEach((item) => {
        item.IdProduto === 18 && sizeCounts["media"]++;
        item.IdProduto === 19 && sizeCounts["familia"]++;
      });
    });

    return sizeCounts;
  }

  #flavorCounts() {
    const flavorCounts: Record<string, number> = {};

    this.#orders.forEach((order) => {
      order.Itens.forEach((item) => {
        item.Sabores.forEach((sabor) => {
          const description = sabor.Descricao;
          if (flavorCounts[description]) {
            flavorCounts[description]++;
          } else {
            flavorCounts[description] = 1;
          }
        });
      });
    });

    return flavorCounts;
  }

  #topThreeToppings() {
    const flavorCounts = this.#flavorCounts();

    const result: Record<string, number> = {};

    const sortedFlavors = Object.entries(flavorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);

    sortedFlavors.forEach((flavor) => {
      result[flavor] = flavorCounts[flavor];
    });

    return result;
  }

  #lastTopping() {
    const flavorCounts = this.#flavorCounts();

    const sortedFlavors = Object.entries(flavorCounts)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 1)
      .map((entry) => entry[0]);

    return sortedFlavors[0];
  }
}
