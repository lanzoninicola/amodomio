import { createFirestoreModel } from "~/lib/firestore-model/src";

export interface DailyOrder {
  id?: string;
  date: string;
  largePizzaNumber: number;
  mediumPizzaNumber: number;
  transactions: DailyOrderTransaction[];
}

export interface DailyOrderTransaction {
  id?: string;
  product: DOTProduct;
  amount: number;
  orderNumber: number;
  isMotoRequired: boolean;
  amountMotoboy: number;
  inboudChannel: DOTInboudChannel;
  paymentMethod: DOTPaymentMethod;
  deletedAt: string;
}

export type DOTProduct =
  | "Pizza Familía"
  | "Pizza Media"
  | "Al Taglio"
  | "Bebida";
export type DOTInboudChannel = "Mogo" | "Aiqfome";
export type DOTPaymentMethod =
  | "Dinheiro"
  | "PIX"
  | "AIQFome"
  | "Cartão Credito"
  | "Cartão Debito";

const DailyOrderModel = createFirestoreModel<DailyOrder>("daily-order");

export { DailyOrderModel };
