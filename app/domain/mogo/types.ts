export interface MogoBaseOrder {
  Id: number;
  NumeroPedido: string;
  Itens: {
    IdProduto: number;
    IdItemPedido: number;
    Descricao: string;
    Observacao: string | null;
    Quantidade: number;
    ValorUnitario: number;
    Adicionais: any[]; // Pode ser um array de objetos com propriedades específicas
    Sabores: {
      Descricao: string;
      Quantidade: number;
      Valor: number;
    }[];
  }[];
  SubTotal: number;
  TaxaEntrega: number;
  DataPedido: string;
  HoraPedido: string;
  HoraEntrega: string | null;
  HoraAcerto: string;
  FormaPagamento: string;
  TrocoDelivery: number;
  Logradouro: string;
  Numero: string;
  Bairro: string;
  Cidade: string;
  UF: string;
  ReaisDesconto: number;
  PercentualDesconto: number;
  StatusPedido: number;
  StatusEntrega: number;
  HoraEntregaTxt: string;
  DataEntregaTxt: string | null;
  CodObsEntrega: number;
  DataSaidaEntregador: string | null;
  Adiantamentos: any; // Pode ser de um tipo específico ou null
  IdPedRemoteDevice: string;
  ObsEntrega: any; // Pode ser de um tipo específico ou null
  Vendedor: any; // Pode ser de um tipo específico ou null
  Cliente: string;
  IdCliente: number;
  IdEntregador: number;
  Latitude: string;
  Longitude: string;
  ReferenceIFood: any; // Pode ser de um tipo específico ou null
  PickupCode: any; // Pode ser de um tipo específico ou null
}

export interface MogoOrderWithDiffTime extends MogoBaseOrder {
  diffMinutesOrderDateTimeToNow: number;
  diffMinutesDeliveryDateTimeToNow: number;
}

export interface MogoHttpClientInterface {
  getOrdersOpened(): Promise<MogoBaseOrder[]>;
}
