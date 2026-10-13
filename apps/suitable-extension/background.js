import "./parser.js";
import "./activation.js";
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
const inFlight = new Set();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    ![
      "suitable:create",
      "suitable:zones",
      "suitable:check",
      "suitable:customer",
      "suitable:open-day",
    ].includes(message?.type)
  )
    return;
  (async () => {
    const { serverUrl, apiKey, suitableOrigin, modules } =
      await chrome.storage.local.get([
        "serverUrl",
        "apiKey",
        "suitableOrigin",
        "modules",
      ]);
    if (!sender.tab || new URL(sender.url).origin !== suitableOrigin)
      throw new Error("Página não autorizada. Ative a extensão nesta página.");
    if (modules?.kds?.enabled === false)
      throw new Error(
        "A integração com o KDS está desativada nas configurações."
      );
    if (!serverUrl || !apiKey)
      throw new Error("Configure o servidor e a chave da API na extensão.");
    if (message.type === "suitable:open-day") {
      const response = await fetch(`${serverUrl}/api/kds/day/open`, {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ date: message.order?.date }),
        signal: AbortSignal.timeout(20000),
      });
      if ([404, 405].includes(response.status))
        throw new Error(
          "Atualize o servidor Amodomio com a rota /api/kds/day/open."
        );
      const result = await response.json().catch(() => {
        throw new Error(
          "O servidor não retornou uma resposta válida para a abertura do dia."
        );
      });
      if (
        !response.ok ||
        !result.ok ||
        !["OPENED", "REOPENED"].includes(result.status)
      )
        throw new Error(result.error || "Não foi possível abrir o dia.");
      return { ok: true, dayStatus: result.status };
    }
    if (message.type === "suitable:customer") {
      const query = new URLSearchParams({
        phone: String(message.phone || ""),
        purchaseSummary: "1",
      });
      const response = await fetch(`${serverUrl}/api/crm/customers?${query}`, {
        credentials: "omit",
        redirect: "error",
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error("Não foi possível consultar o histórico do CRM.");
      return { ok: true, purchaseSummary: result.purchaseSummary ?? null };
    }
    if (message.type === "suitable:zones") {
      const response = await fetch(`${serverUrl}/api/kds/delivery-zones`, {
        credentials: "omit",
        redirect: "error",
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !Array.isArray(result.zones))
        throw new Error(
          "Não foi possível carregar os bairros do KDS. Confira servidor e chave e tente novamente."
        );
      return { ok: true, zones: result.zones };
    }
    if (message.type === "suitable:check") {
      const input = message.order;
      const response = await fetch(`${serverUrl}/api/kds/orders/check`, {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          date: input?.date,
          commandNumber: input?.commandNumber,
          orderItems: input?.orderItems,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if ([404, 405].includes(response.status))
        throw new Error(
          "A consulta de comanda e estoque não está disponível neste servidor. Atualize o servidor Amodomio com a rota /api/kds/orders/check."
        );
      if ([401, 403].includes(response.status))
        throw new Error(
          "Consulta não autorizada. Confira a chave da API nas configurações globais."
        );
      const result = await response.json().catch(() => {
        throw new Error(
          "O servidor não retornou uma consulta válida. Confira o endereço do servidor."
        );
      });
      if (!response.ok || !result.ok || !result.check)
        throw new Error(
          result.error || "Não foi possível consultar pedido e estoque."
        );
      return { ok: true, check: result.check };
    }
    const input = message.order;
    if (
      !input ||
      !Number.isSafeInteger(input.commandNumber) ||
      input.commandNumber <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      !Number.isFinite(input.orderAmount) ||
      input.orderAmount < 0 ||
      typeof input.customerName !== "string" ||
      !input.customerName.trim() ||
      typeof input.customerPhone !== "string"
    )
      throw new Error("Confira número, data, valor e cliente.");
    const orderItems = SuitableKds.validateItems(input.orderItems);
    if (
      input.channel !== undefined &&
      (typeof input.channel !== "string" ||
        !input.channel.trim() ||
        input.channel.length > 100)
    )
      throw new Error("Selecione uma origem válida para o pedido.");
    if (
      !input.takeAway &&
      (!Number.isFinite(input.deliveryFee) ||
        input.deliveryFee < 0 ||
        typeof input.deliveryZoneId !== "string" ||
        !input.deliveryZoneId.trim())
    )
      throw new Error(
        "Confira a taxa e selecione um bairro cadastrado no KDS."
      );
    const key = `${serverUrl}:${input.date}:${input.commandNumber}`;
    if (inFlight.has(key))
      throw new Error("Esta comanda já está sendo enviada.");
    inFlight.add(key);
    try {
      const response = await fetch(`${serverUrl}/api/kds/orders`, {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          date: input.date,
          commandNumber: input.commandNumber,
          customerName: input.customerName.trim().slice(0, 200),
          customerPhone: input.customerPhone.replace(/\D/g, "").slice(0, 20),
          orderAmount: input.orderAmount,
          takeAway: input.takeAway === true,
          hasMoto: input.takeAway !== true,
          motoValue: input.takeAway ? 0 : input.deliveryFee,
          deliveryZoneId: input.takeAway ? null : input.deliveryZoneId,
          channel:
            input.channel === undefined ||
            input.channel.trim().toLowerCase() === "suitable"
              ? "CARDAPIO"
              : input.channel.trim(),
          orderItems,
          updateExisting: input.updateExisting === true,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const messages = {
          duplicate_command_number:
            "Já existe um pedido nesta comanda. Confira no Atendimento antes de alterar o número.",
          day_closed: "O dia está fechado no KDS.",
          day_not_open: "Abra o dia no Atendimento antes de importar pedidos.",
          insufficient_dough_stock: `Estoque de massas insuficiente. ${
            result.message || "Confira o saldo no Atendimento."
          }`,
          invalid_delivery: "Confira a entrega, o bairro e a taxa do pedido.",
          invalid_delivery_fee:
            "Confira a taxa: ela não pode ser negativa ou superar o total.",
          invalid_delivery_zone_id: "Selecione um bairro existente no KDS.",
          invalid_order_amount:
            "Confira o total do pedido, com até duas casas decimais.",
          invalid_command_number: "Informe uma comanda inteira e positiva.",
          invalid_date: "Confira a data do pedido.",
          import_conflict:
            "Outro pedido alterou o dia. Confira a comanda no Atendimento antes de tentar novamente.",
          unauthorized: "Chave da API inválida ou servidor sem configuração.",
          invalid_order_items: "Confira os itens e tamanhos das pizzas.",
          too_many_requests: "Muitas solicitações. Aguarde um minuto.",
        };
        throw new Error(
          messages[result.error] ||
            `Servidor recusou o pedido (${response.status}).`
        );
      }
      return {
        ok: true,
        id: result.id,
        status: result.status,
        reopenedDay: result.reopenedDay === true,
      };
    } finally {
      inFlight.delete(key);
    }
  })()
    .then(respond)
    .catch((error) =>
      respond({
        ok: false,
        error:
          error.name === "TimeoutError"
            ? "Tempo esgotado. Confira no Atendimento se a comanda foi criada antes de tentar novamente."
            : error.message,
      })
    );
  return true;
});
