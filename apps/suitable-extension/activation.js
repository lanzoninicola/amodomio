const SCRIPT_ID = "suitable-kds";
let activationQueue = Promise.resolve();

function origin(raw) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Informe somente a origem HTTP/HTTPS, sem caminho ou senha."
    );
  }
  return url.origin;
}

async function activateSavedConfiguration(tabId) {
  const config = await chrome.storage.local.get([
    "serverUrl",
    "apiKey",
    "suitableOrigin",
    "activationTabId",
    "modules",
  ]);
  if (!config.serverUrl || !config.apiKey || !config.suitableOrigin) {
    return {
      state: "unconfigured",
      message:
        "Salve o servidor e a chave da API. Depois ative a conexão na aba do Suitable.",
    };
  }
  const origins = [
    ...new Set([`${config.serverUrl}/*`, `${config.suitableOrigin}/*`]),
  ];
  if (!(await chrome.permissions.contains({ origins }))) {
    const status = {
      state: "waiting",
      message:
        "Dados salvos. Clique em Ativar na aba atual para permitir acesso aos sites.",
    };
    await chrome.storage.local.set({ activationStatus: status });
    return status;
  }
  const scripts = await chrome.scripting.getRegisteredContentScripts({
    ids: [SCRIPT_ID],
  });
  const script = {
    id: SCRIPT_ID,
    matches: [`${config.suitableOrigin}/*`],
    js: ["parser.js", "content.js"],
    runAt: "document_idle",
  };
  if (scripts.length) await chrome.scripting.updateContentScripts([script]);
  else
    await chrome.scripting.registerContentScripts([
      { ...script, persistAcrossSessions: true },
    ]);

  const targetId = tabId ?? config.activationTabId;
  let injected = false;
  if (Number.isInteger(targetId)) {
    // A closed/navigated tab does not invalidate the saved configuration or registration.
    const tab = await chrome.tabs.get(targetId).catch(() => null);
    if (tab?.url && new URL(tab.url).origin === config.suitableOrigin) {
      await chrome.scripting.executeScript({
        target: { tabId: targetId },
        files: ["parser.js", "content.js"],
      });
      injected = true;
    }
  }
  const status = {
    state: "active",
    message: injected
      ? "Dados salvos e extensão ativada. Abra um pedido ou uma nota de compra para usar as integrações."
      : "Dados salvos e extensão ativada. Recarregue o Suitable e abra um pedido ou uma nota de compra.",
  };
  await chrome.storage.local.set({ activationStatus: status });
  return status;
}

function activate(tabId) {
  activationQueue = activationQueue
    .catch(() => {})
    .then(() => activateSavedConfiguration(tabId))
    .catch(async (error) => {
      const status = {
        state: "error",
        message: `Dados salvos, mas a ativação falhou: ${error.message}`,
      };
      await chrome.storage.local.set({ activationStatus: status });
      return status;
    });
  return activationQueue;
}

chrome.permissions.onAdded.addListener(() => activate());
chrome.permissions.onRemoved.addListener(() => activate());
chrome.runtime.onInstalled.addListener(() => activate());

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!["suitable:configure", "suitable:activate"].includes(message?.type))
    return;
  (async () => {
    if (
      sender.id !== chrome.runtime.id ||
      sender.tab ||
      sender.url !== chrome.runtime.getURL("popup.html")
    ) {
      throw new Error(
        "Configuração disponível somente pelo popup da extensão."
      );
    }
    if (message.type === "suitable:configure") {
      const serverUrl = origin(message.config?.serverUrl);
      const saved = await chrome.storage.local.get([
        "suitableOrigin",
        "modules",
      ]);
      const suitableOrigin = message.config?.suitableOrigin
        ? origin(message.config.suitableOrigin)
        : saved.suitableOrigin || null;
      if (
        message.config?.modules !== undefined &&
        typeof message.config.modules?.kds?.enabled !== "boolean"
      )
        throw new Error("Confira a configuração da integração KDS.");
      if (
        message.config?.modules?.stock !== undefined &&
        (typeof message.config.modules.stock.enabled !== "boolean" ||
          (message.config.modules.stock.checkTotal !== undefined &&
            typeof message.config.modules.stock.checkTotal !== "boolean"))
      )
        throw new Error("Confira a configuração da entrada de NFs.");
      const kdsEnabled =
        message.config?.modules?.kds?.enabled ??
        saved.modules?.kds?.enabled ??
        true;
      const stockEnabled =
        message.config?.modules?.stock?.enabled ??
        saved.modules?.stock?.enabled ??
        true;
      const stockCheckTotal =
        message.config?.modules?.stock?.checkTotal ??
        saved.modules?.stock?.checkTotal ??
        false;
      if (
        typeof message.config?.apiKey !== "string" ||
        !message.config.apiKey.trim() ||
        message.config.apiKey.length > 10000
      )
        throw new Error("Informe a chave da API.");
      // This write belongs to the service worker, so closing the popup cannot cancel it.
      await chrome.storage.local.set({
        serverUrl,
        suitableOrigin,
        apiKey: message.config.apiKey.trim(),
        modules: {
          ...saved.modules,
          kds: {
            ...saved.modules?.kds,
            enabled: kdsEnabled,
          },
          stock: {
            ...saved.modules?.stock,
            enabled: stockEnabled,
            checkTotal: stockCheckTotal,
          },
        },
        ...(Number.isInteger(message.tabId)
          ? { activationTabId: message.tabId }
          : {}),
        configurationVersion: 2,
      });
      // Reflect module preferences in already-open authorized pages.
      if (suitableOrigin && chrome.tabs.query) {
        const tabs = await chrome.tabs
          .query({ url: `${suitableOrigin}/*` })
          .catch(() => []);
        for (const tab of tabs) {
          if (Number.isInteger(tab.id) && chrome.tabs.sendMessage) {
            await chrome.tabs
              .sendMessage(tab.id, {
                type: "suitable:preferences",
                kdsEnabled,
                stockEnabled,
                stockCheckTotal,
              })
              .catch(() => {});
          }
        }
      }
      if (!Number.isInteger(message.tabId)) {
        // Saving global/module settings requires no tab and no website permission.
        if (message.config?.modules?.kds?.enabled === false) await activate();
        return {
          ok: true,
          state: "saved",
          message: "Configurações salvas neste navegador.",
        };
      }
    }
    const status = await activate(message.tabId);
    return { ok: true, ...status };
  })()
    .then(respond)
    .catch((error) => respond({ ok: false, error: error.message }));
  return true;
});
