import { createFirestoreModel } from "~/lib/firestore-model/src";

export interface DailyOrder {
  id?: string;
  date: string;
  initialLargePizzaNumber: number;
  restLargePizzaNumber: number;
  initialMediumPizzaNumber: number;
  restMediumPizzaNumber: number;
  totalOrdersNumber: number;
  totalOrdersAmount: number;
  totalMotoboyAmount: number;
  transactions: DailyOrderTransaction[];
  operator: DOTOperator;
  lastOrderNumber: number;
}

export interface DailyOrderTransaction {
  id?: string;
  product: DOTProduct;
  amount: number;
  orderNumber: number;
  isMotoRequired: boolean;
  amountMotoboy: number;
  inboundChannel: DOTInboundChannel;
  paymentMethod: DOTPaymentMethod;
  deletedAt: string | null;
  operator: DOTOperator;
}

export type DOTPizzaSize = "Pizza Familía" | "Pizza Medía";

export type DOTProduct =
  | "Pizza Familía"
  | "Pizza Média"
  | "Al Taglio"
  | "Bebida";
export type DOTInboundChannel = "Mogo" | "Aiqfome";
export type DOTPaymentMethod =
  | "Dinheiro"
  | "PIX"
  | "AIQFome"
  | "Cartão Credito"
  | "Cartão Debito";
export type DOTOperator = { id: number; name: string };

const DailyOrderModel = createFirestoreModel<DailyOrder>("daily-order");

export { DailyOrderModel };
