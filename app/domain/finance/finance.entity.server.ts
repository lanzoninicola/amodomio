import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MogoOrderInbound } from "../mogo-orders-inbound/mogo-orders-inbound.entity.server";
import { jsonParse } from "~/utils/json-helper";
import { MogoBaseOrder } from "../mogo/types";
import MogoOrdersInboundUtility from "../mogo-orders-inbound/mogo-orders-inbound.utility.server";
import dayjs from "dayjs";

export interface ResultadoFinanceiro {
  ordersAmount: number;
  receitaBruta: number;
  resultadoEntrega: number;
  receitaLiquida: number;
}

interface FinanceEntityProps {
  orders: MogoOrderInbound[];
}

export default class FinanceEntity {
  #orders: MogoBaseOrder[] = [];

  #entregaCusto: number = 10;

  constructor({ orders }: FinanceEntityProps) {
    this.#orders = orders.map((o: MogoOrderInbound) =>
      jsonParse(o.rawData ?? "{}")
    );
  }

  /**
   * Fechamento dia
   */
  fechamento(): ResultadoFinanceiro {
    const receitaBruta = this.#totReceita();
    const resultadoEntrega = this.#resultadoEntrega();
    const receitaLiquida = receitaBruta - resultadoEntrega;

    return {
      ordersAmount: this.#orders.length,
      receitaBruta,
      resultadoEntrega,
      receitaLiquida,
    };
  }

  #totReceita() {
    const amount = this.#orders
      .map((o: MogoBaseOrder) => o.SubTotal)
      .reduce((a, b) => a + b, 0);

    return Number(amount.toFixed(2));
  }

  /**
   * Total de receita de entrega pago para o cliente
   *
   * @returns
   */
  #totReceitaEntrega() {
    return this.#orders
      .map((o: MogoBaseOrder) => o.TaxaEntrega)
      .reduce((a, b) => a + b, 0);
  }

  #totCustoEntrega() {
    return this.#ordersDelivered() * this.#entregaCusto;
  }

  /**
   * Total de custo de entrega para a pizzaria
   *
   * @returns
   */
  #resultadoEntrega() {
    return this.#totCustoEntrega() - this.#totReceitaEntrega();
  }

  #ordersDelivered() {
    return this.#orders.filter((o) => o.isDelivery === true).length;
  }
}
