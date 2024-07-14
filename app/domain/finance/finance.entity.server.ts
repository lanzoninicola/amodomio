import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MogoOrderInbound } from "../mogo-orders-inbound/mogo-orders-inbound.entity.server";
import { jsonParse } from "~/utils/json-helper";
import { MogoBaseOrder } from "../mogo/types";

export interface FechamentoDiaResultados {
  ordersAmount: number;
  receitaBruta: number;
  resultadoEntrega: number;
  receitaLiquida: number;
}

class FinanceEntity {
  client;

  entregaCusto: number = 10;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  /**
   *
   * In the MogoOrdersInbound the date is stored as DD/MM/YYYY hh:mm:ss format
   *
   * parse a date string from the format YYYY-MM-DD to DD/MM/YYYY hh:mm:ss,
   *
   * @param dateString '2022-01-01'
   * @returns
   */
  parseDateString(dateString: string) {
    // Extract year, month, and day using substring
    let year = dateString.substring(0, 4);
    let month = dateString.substring(5, 7);
    let day = dateString.substring(8, 10);

    // Set default time as 00:00:00
    let hours = "00";
    let minutes = "00";
    let seconds = "00";

    // Format the date string as DD/MM/YYYY hh:mm:ss
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

  async findAll(): Promise<MogoOrderInbound[]> {
    return this.client.mogoOrdersInbound.findMany();
  }

  async findByDate(date: string): Promise<MogoOrderInbound[]> {
    return this.client.mogoOrdersInbound.findMany({
      where: {
        orderDateStr: {
          equals: this.parseDateString(date),
        },
      },
    });
  }

  async fechamentoDia(date: string) {
    const ordersInbound = await this.findByDate(date);

    const ordersParsed = ordersInbound.map((o: MogoOrderInbound) =>
      jsonParse(o.rawData)
    );

    const receitaBruta = this.#totReceita(ordersParsed);
    const resultadoEntrega = this.#resultadoEntrega(ordersParsed);
    const receitaLiquida = receitaBruta - resultadoEntrega;

    return {
      ordersAmount: ordersInbound.length,
      receitaBruta,
      resultadoEntrega,
      receitaLiquida,
    };
  }

  #totReceita(orders: MogoBaseOrder[]) {
    const amount = orders
      .map((o: MogoBaseOrder) => o.SubTotal)
      .reduce((a, b) => a + b, 0);

    return Number(amount.toFixed(2));
  }

  /**
   * Total de receita de entrega pago para o cliente
   *
   * @param orders
   * @returns
   */
  #totReceitaEntrega(orders: MogoBaseOrder[]) {
    return orders
      .map((o: MogoBaseOrder) => o.TaxaEntrega)
      .reduce((a, b) => a + b, 0);
  }

  #totCustoEntrega(orders: MogoBaseOrder[]) {
    return this.#ordersDelivered(orders) * this.entregaCusto;
  }

  /**
   * Total de custo de entrega para a pizzaria
   *
   * @param orders
   * @returns
   */
  #resultadoEntrega(orders: MogoBaseOrder[]) {
    return this.#totCustoEntrega(orders) - this.#totReceitaEntrega(orders);
  }

  #ordersDelivered(orders: MogoBaseOrder[]) {
    return orders.filter((o) => o.isDelivery === true).length;
  }
}

const financeEntity = new FinanceEntity({ client: prismaClient });

export { financeEntity };
