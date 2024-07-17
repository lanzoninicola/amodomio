import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { MogoOrderInbound } from "../mogo-orders-inbound/mogo-orders-inbound.entity.server";
import { jsonParse } from "~/utils/json-helper";
import { MogoBaseOrder, MogoOrderItem } from "../mogo/types";
import MogoOrdersInboundUtility from "../mogo-orders-inbound/mogo-orders-inbound.utility.server";
import dayjs from "dayjs";

export interface ResultadoFinanceiro {
  ordersAmount: number;
  receitaBruta: number;
  resultadoEntrega: number;
  receitaLiquida: number;
  receitaPorProduto: Record<string, number>;
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

    const receitaPorProduto = this.#receitaPorProduto();

    return {
      ordersAmount: this.#orders.length,
      receitaBruta,
      resultadoEntrega,
      receitaLiquida,
      receitaPorProduto,
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

  #receitaPorProduto() {
    const productsSelled: {
      [key: string]: number;
    }[] = [];

    this.#orders.forEach((o: MogoBaseOrder) => {
      o.Itens.forEach((i: MogoOrderItem) => {
        productsSelled.push({
          [i.Descricao]: i.ValorUnitario * i.Quantidade,
        });
      });
    });

    console.log({ productsSelled });

    return productsSelled;
  }

  #ticketMedioPorDiaTamanho() {
    const productsSelled = this.#receitaPorProduto();

    // const pizzaMedia = productsSelled.filter((p: { [key: string]: number }) => p" === true);
    // const pizzaFamilia = productsSelled.filter((p) => p.PizzaFamilia === true);
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
