import { DOTPaymentMethod } from "./daily-order.model.server";

const dotPaymentMethods = (): DOTPaymentMethod[] => [
  "Dinheiro",
  "PIX",
  "AIQFome",
  "Cartão Credito",
  "Cartão Debito",
];

export default dotPaymentMethods;
