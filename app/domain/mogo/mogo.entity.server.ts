import tryit from "~/utils/try-it";
import mogoHttpClient from "./mogo-http.client.server";
import { MogoBaseOrder, MogoOrderWithDiffTime } from "./types";
import dayjs from "dayjs";
import { setup } from "~/lib/dayjs";

function formatMogoOrderDate(dateStr: string) {
  if (!dateStr) return dateStr;
  const [day, month, year] = dateStr.split(/\/| /);
  return `${year}-${month}-${day}`;
}

function formatMogoOrderTime(timeStr: string) {
  if (!timeStr) return timeStr;
  const [hour, minute, second] = timeStr.split(":");
  return `2000-01-01 ${hour}:${minute}:${second}`;
}

class MogoEntity {
  authToken = process.env.MOGO_TOKEN;
  dbName = process.env.MOGO_DB_NAME;

  constructor() {
    setup();
  }

  async getOrdersOpened(): Promise<MogoOrderWithDiffTime[]> {
    const [err, ordersRes] = await tryit(mogoHttpClient.getOrdersOpened());

    if (err) {
      throw err;
    }

    if (!Array.isArray(ordersRes)) {
      return [];
    }

    // const ordersRes = [
    //   {
    //     Id: 727,
    //     NumeroPedido: "002727",
    //     Itens: [
    //       {
    //         IdProduto: 18,
    //         IdItemPedido: 0,
    //         Descricao: "Pizza Tamanho Médio",
    //         Observacao: "",
    //         Quantidade: 1.0,
    //         ValorUnitario: 89.9,
    //         Adicionais: [],
    //         Sabores: [
    //           { Descricao: "Affumicata", Quantidade: 1.0, Valor: 89.9 },
    //         ],
    //       },
    //     ],
    //     SubTotal: 89.9,
    //     TaxaEntrega: 0.0,
    //     DataPedido: "02/01/2024 00:00:00",
    //     HoraPedido: "12:17:33",
    //     HoraEntrega: "12:18",
    //     HoraAcerto: "",
    //     FormaPagamento: "Dinheiro",
    //     TrocoDelivery: 0.0,
    //     Logradouro: "",
    //     Numero: "",
    //     Bairro: "",
    //     Cidade: "",
    //     UF: "",
    //     ReaisDesconto: 0.0,
    //     PercentualDesconto: 0.0,
    //     StatusPedido: 0,
    //     StatusEntrega: 0,
    //     HoraEntregaTxt: "12:18:49",
    //     DataEntregaTxt: null,
    //     CodObsEntrega: 1,
    //     DataSaidaEntregador: "02/01/2024",
    //     Adiantamentos: null,
    //     IdPedRemoteDevice: "638398054210590000",
    //     ObsEntrega: null,
    //     Vendedor: null,
    //     Cliente: "Nicola Lanzoni",
    //     IdCliente: 535,
    //     IdEntregador: 0,
    //     Latitude: "",
    //     Longitude: "",
    //     ReferenceIFood: null,
    //     PickupCode: null,
    //   },
    //   {
    //     Id: 727,
    //     NumeroPedido: "000927",
    //     Itens: [
    //       {
    //         IdProduto: 18,
    //         IdItemPedido: 0,
    //         Descricao: "Pizza Tamanho Médio",
    //         Observacao: "",
    //         Quantidade: 1.0,
    //         ValorUnitario: 89.9,
    //         Adicionais: [],
    //         Sabores: [
    //           { Descricao: "Affumicata", Quantidade: 1.0, Valor: 89.9 },
    //         ],
    //       },
    //     ],
    //     SubTotal: 89.9,
    //     TaxaEntrega: 0.0,
    //     DataPedido: "02/01/2024 00:00:00",
    //     HoraPedido: "12:17:33",
    //     HoraEntrega: "12:18",
    //     HoraAcerto: "",
    //     FormaPagamento: "Dinheiro",
    //     TrocoDelivery: 0.0,
    //     Logradouro: "",
    //     Numero: "",
    //     Bairro: "",
    //     Cidade: "",
    //     UF: "",
    //     ReaisDesconto: 0.0,
    //     PercentualDesconto: 0.0,
    //     StatusPedido: 0,
    //     StatusEntrega: 0,
    //     HoraEntregaTxt: "12:18:49",
    //     DataEntregaTxt: null,
    //     CodObsEntrega: 1,
    //     DataSaidaEntregador: "02/01/2024",
    //     Adiantamentos: null,
    //     IdPedRemoteDevice: "638398054210590000",
    //     ObsEntrega: null,
    //     Vendedor: null,
    //     Cliente: "Nicola Lanzoni",
    //     IdCliente: 535,
    //     IdEntregador: 0,
    //     Latitude: "",
    //     Longitude: "",
    //     ReferenceIFood: null,
    //     PickupCode: null,
    //   },
    //   {
    //     Id: 727,
    //     NumeroPedido: "000797",
    //     Itens: [
    //       {
    //         IdProduto: 18,
    //         IdItemPedido: 0,
    //         Descricao: "Pizza Tamanho Médio",
    //         Observacao: "",
    //         Quantidade: 1.0,
    //         ValorUnitario: 89.9,
    //         Adicionais: [],
    //         Sabores: [
    //           { Descricao: "Affumicata", Quantidade: 1.0, Valor: 89.9 },
    //         ],
    //       },
    //     ],
    //     SubTotal: 89.9,
    //     TaxaEntrega: 0.0,
    //     DataPedido: "02/01/2024 00:00:00",
    //     HoraPedido: "12:17:33",
    //     HoraEntrega: "12:18",
    //     HoraAcerto: "",
    //     FormaPagamento: "Dinheiro",
    //     TrocoDelivery: 0.0,
    //     Logradouro: "",
    //     Numero: "",
    //     Bairro: "",
    //     Cidade: "",
    //     UF: "",
    //     ReaisDesconto: 0.0,
    //     PercentualDesconto: 0.0,
    //     StatusPedido: 0,
    //     StatusEntrega: 0,
    //     HoraEntregaTxt: "12:18:49",
    //     DataEntregaTxt: null,
    //     CodObsEntrega: 1,
    //     DataSaidaEntregador: "02/01/2024",
    //     Adiantamentos: null,
    //     IdPedRemoteDevice: "638398054210590000",
    //     ObsEntrega: null,
    //     Vendedor: null,
    //     Cliente: "Nicola Lanzoni",
    //     IdCliente: 535,
    //     IdEntregador: 0,
    //     Latitude: "",
    //     Longitude: "",
    //     ReferenceIFood: null,
    //     PickupCode: null,
    //   },
    //   {
    //     Id: 727,
    //     NumeroPedido: "000729",
    //     Itens: [
    //       {
    //         IdProduto: 18,
    //         IdItemPedido: 0,
    //         Descricao: "Pizza Tamanho Médio",
    //         Observacao: "",
    //         Quantidade: 1.0,
    //         ValorUnitario: 89.9,
    //         Adicionais: [],
    //         Sabores: [
    //           { Descricao: "Affumicata", Quantidade: 1.0, Valor: 89.9 },
    //         ],
    //       },
    //     ],
    //     SubTotal: 89.9,
    //     TaxaEntrega: 0.0,
    //     DataPedido: "02/01/2024 00:00:00",
    //     HoraPedido: "12:17:33",
    //     HoraEntrega: "12:18",
    //     HoraAcerto: "",
    //     FormaPagamento: "Dinheiro",
    //     TrocoDelivery: 0.0,
    //     Logradouro: "",
    //     Numero: "",
    //     Bairro: "",
    //     Cidade: "",
    //     UF: "",
    //     ReaisDesconto: 0.0,
    //     PercentualDesconto: 0.0,
    //     StatusPedido: 0,
    //     StatusEntrega: 0,
    //     HoraEntregaTxt: "12:18:49",
    //     DataEntregaTxt: null,
    //     CodObsEntrega: 1,
    //     DataSaidaEntregador: "02/01/2024",
    //     Adiantamentos: null,
    //     IdPedRemoteDevice: "638398054210590000",
    //     ObsEntrega: null,
    //     Vendedor: null,
    //     Cliente: "Nicola Lanzoni",
    //     IdCliente: 535,
    //     IdEntregador: 0,
    //     Latitude: "",
    //     Longitude: "",
    //     ReferenceIFood: null,
    //     PickupCode: null,
    //   },
    // ];

    const now = dayjs();

    const orders = ordersRes.map((o: MogoBaseOrder) => {
      const orderDate = formatMogoOrderDate(o.DataPedido);
      const orderTime = formatMogoOrderTime(o.HoraPedido);
      const deliveryExpectedTime = formatMogoOrderTime(o.HoraEntregaTxt);

      const parsedDate = dayjs(orderDate, "DD/MM/YYYY HH:mm:ss", "pt-br");
      const parsedTime = dayjs(orderTime, "HH:mm:ss", "pt-br");
      const parsedDeliveryExpectedTime = dayjs(
        deliveryExpectedTime,
        "HH:mm:ss",
        "pt-br"
      );

      const orderDateTime = parsedDate
        .set("hour", parsedTime.hour())
        .set("minute", parsedTime.minute())
        .set("second", parsedTime.second());

      const orderDeliveryDateTime = parsedDate
        .set("hour", parsedDeliveryExpectedTime.hour())
        .set("minute", parsedDeliveryExpectedTime.minute())
        .set("second", parsedDeliveryExpectedTime.second());

      return {
        ...o,
        diffMinutesToNow: 9,
      };
    });

    return orders;
  }
}

const mogoEntity = new MogoEntity();

export default mogoEntity;
