import type { KdsOrder } from "./types";

export function orderWhatsappTemplate(order: KdsOrder): string {
  const greeting = order.customerName?.trim()
    ? `Olá, ${order.customerName.trim()}!`
    : "Olá!";
  if (order.status === "aguardandoForno") {
    return `${greeting} Podemos colocar a sua pizza no forno?`;
  }
  if (order.status === "assando") {
    return `${greeting} A sua pizza está no forno! Em poucos minutos estará pronta.${
      order.takeAway ? " Aguardamos sua chegada!" : ""
    }`;
  }
  const number =
    order.commandNumber == null
      ? "Seu pedido"
      : `Seu pedido #${order.commandNumber}`;
  const updates: Record<string, string> = {
    pendente: "foi registrado e aguarda confirmação.",
    novoPedido:
      "foi recebido pela nossa cozinha. Em breve começaremos o preparo!",
    emProducao: "está em preparo pela nossa equipe!",
    finalizado: order.takeAway
      ? "está pronto para retirada no balcão! Esperamos você."
      : "está pronto! Estamos organizando a entrega.",
  };
  return `${greeting} ${number} ${
    updates[order.status] ??
    "teve uma atualização. Fale conosco para mais informações."
  } — Amodomio`;
}
