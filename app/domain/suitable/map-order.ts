import { suitableCommandNumber, suitableDisplayNumber } from "./order-display";
import type { KdsOrderItem } from "~/domain/kds/order-items";
import type { SuitableOrderDetails } from "./suitable-client.server";

export type KdsFormFill = {
  channel: "Suitable";
  customerName: string;
  customerPhone: string;
  orderAmount: number;
  hasMoto: boolean;
  motoValue: number;
  takeAway: boolean;
  isCreditCard: boolean;
  isCash: boolean;
  isOtherPaymentMethod: boolean;
  sizes: { F: number; M: number; P: number; I: number; FT: number };
  unmappedItems: string[];
  notes: string[];
  address: string | null;
  changeFor: string | null;
  suitableOrderId: number;
  commandNumber: number | null;
  paid: boolean;
  changeForValue: number | null;
  orderItems: KdsOrderItem[];
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Heurística por nome/categoria/opções; ajustar aos nomes reais do cardápio. */
export function detectSize(text: string): keyof KdsFormFill["sizes"] | null {
  const t = norm(text);
  if (/\bgigante\b|\bfamilia\b/.test(t)) return "F";
  if (/\bgrande\b/.test(t)) return "F";
  if (/\bmedia\b/.test(t)) return "M";
  if (/\bpequena\b|\bbroto\b/.test(t)) return "P";
  if (/\bindividual\b/.test(t)) return "I";
  return null;
}

const num = (v: string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function mapSuitableOrder(o: SuitableOrderDetails): KdsFormFill {
  const sizes = { F: 0, M: 0, P: 0, I: 0, FT: 0 };
  const unmappedItems: string[] = [];
  const displayNumber = suitableDisplayNumber(o.display_number);
  const notes: string[] = displayNumber ? [`Pedido Suitable #${displayNumber}`] : [];
  const orderItems: KdsOrderItem[] = [];
  for (const item of o.items ?? []) {
    const opts = (item.options ?? []).map((x) => x.name);
    const isPizza = /pizza/.test(norm(`${item.name} ${item.category ?? ""}`));
    const size = detectSize(
      [item.name, item.category ?? "", ...opts].join(" ")
    );
    if (size) sizes[size] += item.quantity;
    else if (isPizza) unmappedItems.push(`${item.quantity}x ${item.name}`);
    if (item.comments) notes.push(`${item.name}: ${item.comments}`);
    orderItems.push({
      name: item.name,
      quantity: item.quantity,
      size,
      flavors: (item.options ?? []).map((x) =>
        `${x.quantity > 1 ? `${x.quantity}x ` : ""}${x.group_name ? `${x.group_name}: ` : ""}${x.name}`
      ),
      notes: item.comments ? [item.comments] : [],
    });
  }
  if (o.comments) notes.push(o.comments);

  const methods = o.payment?.methods ?? [];
  const types = methods.map((m) => m.type);
  const isCreditCard = types.includes("Cartão");
  const isCash = !isCreditCard && types.includes("Dinheiro");
  const isOtherPaymentMethod =
    !isCreditCard && !isCash && methods.length > 0;

  const delivery = o.order_type === "delivery";
  const fee = num(o.delivery_fee);
  return {
    channel: "Suitable",
    customerName: o.customer?.name?.trim() ?? "",
    customerPhone: (o.customer?.phone ?? "").replace(/\D/g, ""),
    orderAmount: num(o.total),
    hasMoto: delivery,
    motoValue: delivery ? fee : 0,
    takeAway: o.order_type === "takeout",
    isCreditCard,
    isCash,
    isOtherPaymentMethod,
    sizes,
    unmappedItems,
    notes,
    address: o.delivery_address?.formatted ?? null,
    changeFor: o.payment?.change_for ?? null,
    suitableOrderId: o.id,
    commandNumber: suitableCommandNumber(o.display_number),
    paid: Boolean(o.paid || o.payment?.paid),
    changeForValue: o.payment?.change_for ? num(o.payment.change_for) : null,
    orderItems,
  };
}
