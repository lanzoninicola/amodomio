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
  userLogged: string;
}

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

const DailyOrderModel = createFirestoreModel<DailyOrder>("daily-order");

export { DailyOrderModel };
