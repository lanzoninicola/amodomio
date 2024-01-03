import tryit from "~/utils/try-it";
import mogoHttpClient from "./mogo-http.client.server";
import dayjs from "dayjs";
import { MogoOrderWithDiffTime } from "./types";

class MogoEntity {
  authToken = process.env.MOGO_TOKEN;
  dbName = process.env.MOGO_DB_NAME;

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

    const orders = ordersRes.map((o) => {
      // Convertendo a string em um objeto Day.js com a data atual
      const horaEntregaObjeto = dayjs()
        .set("hour", parseInt(o.HoraEntrega.split(":")[0]))
        .set("minute", parseInt(o.HoraEntrega.split(":")[1]));

      // Calculando a diferença em minutos entre agora e a hora de entrega
      const diffMinutesToNow = horaEntregaObjeto.diff(now, "minute") * -1;

      return {
        ...o,
        diffMinutesToNow,
      };
    });

    return orders;
  }
}

const mogoEntity = new MogoEntity();

export default mogoEntity;
