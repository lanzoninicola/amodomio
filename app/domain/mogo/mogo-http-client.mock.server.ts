import dayjs from "dayjs";
import { MogoHttpClientInterface, MogoOrderHttpResponse } from "./types";
import { now } from "~/lib/dayjs";

export default class MogoHttpClientMock implements MogoHttpClientInterface {
  // format DD/MM/YYYY
  today: string;
  currentTime: string;

  constructor() {
    this.today = now();
    this.currentTime = dayjs.utc().format("HH:mm:ss");
  }

  calculateOrderTime() {
    const orderTime = dayjs().subtract(30, "minutes");
    return orderTime.format("HH:mm:ss");
  }

  async getOrdersOpened() {
    const orders: MogoOrderHttpResponse[] = [
      {
        Id: 755,
        NumeroPedido: "000755",
        Itens: [
          {
            IdProduto: 19,
            IdItemPedido: 0,
            Descricao: "Pizza Tamanho Grande",
            Observacao: "",
            Quantidade: 1,
            ValorUnitario: 189.9,
            Adicionais: [],
            Sabores: [
              {
                Descricao: "Delicata",
                Quantidade: 1,
                Valor: 189.9,
              },
            ],
          },
          {
            IdProduto: 18,
            IdItemPedido: 0,
            Descricao: "Pizza Tamanho Médio",
            Observacao: "",
            Quantidade: 1,
            ValorUnitario: 89.9,
            Adicionais: [],
            Sabores: [
              {
                Descricao: "Affumicata",
                Quantidade: 1,
                Valor: 89.9,
              },
              {
                Descricao: "Mortazza",
                Quantidade: 1,
                Valor: 119.9,
              },
            ],
          },
          {
            IdProduto: 18,
            IdItemPedido: 0,
            Descricao: "Pizza Tamanho Médio",
            Observacao: "",
            Quantidade: 1,
            ValorUnitario: 89.9,
            Adicionais: [],
            Sabores: [
              {
                Descricao: "Affumicata",
                Quantidade: 1,
                Valor: 89.9,
              },
              {
                Descricao: "Mortazza",
                Quantidade: 1,
                Valor: 119.9,
              },
            ],
          },
          {
            IdProduto: 18,
            IdItemPedido: 0,
            Descricao: "Pizza Tamanho Médio",
            Observacao: "",
            Quantidade: 1,
            ValorUnitario: 89.9,
            Adicionais: [],
            Sabores: [
              {
                Descricao: "Affumicata",
                Quantidade: 1,
                Valor: 89.9,
              },
              {
                Descricao: "Mortazza",
                Quantidade: 1,
                Valor: 119.9,
              },
            ],
          },
        ],
        SubTotal: 189.9,
        TaxaEntrega: 0,
        DataPedido: `${this.today} 00:00:00`,
        HoraPedido: "12:36:54",
        // HoraPedido: `${this.calculateOrderTime()}`,
        HoraEntrega: null,
        HoraAcerto: "",
        FormaPagamento: "Dinheiro",
        TrocoDelivery: 0,
        Logradouro: "",
        Numero: "",
        Bairro: "",
        Cidade: "",
        UF: "",
        ReaisDesconto: 0,
        PercentualDesconto: 0,
        StatusPedido: 0,
        StatusEntrega: 0,
        HoraEntregaTxt: "00:00:00",
        DataEntregaTxt: null,
        CodObsEntrega: 1,
        DataSaidaEntregador: null,
        Adiantamentos: null,
        IdPedRemoteDevice: "638406675936030000",
        ObsEntrega: "",
        Vendedor: null,
        Cliente: "Nicola Lanzoni (balcão)",
        IdCliente: 535,
        IdEntregador: 0,
        Latitude: "",
        Longitude: "",
        ReferenceIFood: null,
        PickupCode: null,
      },
      {
        Id: 754,
        NumeroPedido: "000754",
        Itens: [
          {
            IdProduto: 18,
            IdItemPedido: 0,
            Descricao: "Pizza Tamanho Médio",
            Observacao: "",
            Quantidade: 1,
            ValorUnitario: 89.9,
            Adicionais: [],
            Sabores: [
              {
                Descricao: "Affumicata",
                Quantidade: 1,
                Valor: 89.9,
              },
            ],
          },
          {
            IdProduto: 20,
            IdItemPedido: 0,
            Descricao: "Taxa de entrega",
            Observacao: null,
            Quantidade: 1,
            ValorUnitario: 8,
            Adicionais: [],
            Sabores: [],
          },
        ],
        SubTotal: 89.9,
        TaxaEntrega: 8,
        DataPedido: `${this.today} 00:00:00`,
        HoraPedido: "12:20:19",
        HoraEntrega: null,
        HoraAcerto: "",
        FormaPagamento: "Dinheiro",
        TrocoDelivery: 0,
        Logradouro: "Rua Prefeito Plácido Machado",
        Numero: "84",
        Bairro: "La Salle",
        Cidade: "",
        UF: "",
        ReaisDesconto: 0,
        PercentualDesconto: 0,
        StatusPedido: 0,
        StatusEntrega: 0,
        HoraEntregaTxt: "00:00:00",
        DataEntregaTxt: null,
        CodObsEntrega: 0,
        DataSaidaEntregador: null,
        Adiantamentos: null,
        IdPedRemoteDevice: "638406675466480000",
        ObsEntrega: "Essa é uma observação",
        Vendedor: null,
        Cliente: "Nicola Lanzoni (entrega)",
        IdCliente: 535,
        IdEntregador: 0,
        Latitude: "",
        Longitude: "",
        ReferenceIFood: null,
        PickupCode: null,
      },
    ];

    return new Promise<MogoOrderHttpResponse[]>((resolve) => {
      resolve(orders);
    });
  }
}
