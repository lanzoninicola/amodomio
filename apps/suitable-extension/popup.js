const form = document.querySelector("#config");
const server = document.querySelector("#server");
const key = document.querySelector("#key");
const enabled = document.querySelector("#kds-enabled");
const stockEnabled = document.querySelector("#stock-enabled");
const stockBlockAccounts = document.querySelector("#stock-block-accounts");
const stockCheckTotal = document.querySelector("#stock-check-total");
const status = document.querySelector("#status");
const save = document.querySelector("#save");
const activate = document.querySelector("#activate");
const site = document.querySelector("#site");
let currentTab = null;
let suitableOrigin = null;
let edited = false;
const reloadMessage =
  "O serviço da extensão não respondeu. Recarregue a extensão em edge://extensions ou chrome://extensions.";
function notify(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}
function showArea(area) {
  const isMenu = area === null;
  for (const name of ["global", "kds", "stock"]) {
    document.querySelector(`#${name}-panel`).hidden = name !== area;
  }
  document.querySelector("nav").hidden = !isMenu;
  document.querySelector("footer").hidden = isMenu;
  document.querySelector("#back").hidden = isMenu;
  document.querySelector("#title").textContent = isMenu
    ? "Integração Suitable"
    : area === "global"
    ? "Configurações globais"
    : area === "kds"
    ? "KDS"
    : "Entrada de NFs";
  document.querySelector(isMenu ? "#global-tab" : "#back").focus();
}
document.querySelector("#back").onclick = () => showArea(null);
document.querySelector("#global-tab").onclick = () => showArea("global");
document.querySelector("#kds-tab").onclick = () => showArea("kds");
document.querySelector("#stock-tab").onclick = () => showArea("stock");
form.addEventListener("input", () => {
  edited = true;
});
form.addEventListener("invalid", () => showArea("global"), true);
save.disabled = activate.disabled = true;
(async () => {
  try {
    const saved = await chrome.storage.local.get([
      "serverUrl",
      "apiKey",
      "suitableOrigin",
      "modules",
    ]);
    if (!edited) {
      server.value = saved.serverUrl || "";
      key.value = saved.apiKey || "";
      enabled.checked = saved.modules?.kds?.enabled !== false;
      stockEnabled.checked = saved.modules?.stock?.enabled !== false;
      stockBlockAccounts.checked = saved.modules?.stock?.blockAccounts !== false;
      stockCheckTotal.checked = saved.modules?.stock?.checkTotal === true;
    }
    suitableOrigin = saved.suitableOrigin || null;
    site.textContent = suitableOrigin || "Nenhum site vinculado.";
    // Opening settings never activates a random current website.
    [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
  } catch (error) {
    notify(error.message, true);
  } finally {
    save.disabled = activate.disabled = false;
  }
})();
function configuration() {
  if (!key.value.trim()) throw new Error("Informe a chave da API.");
  const url = new URL(server.value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Informe somente a origem do servidor, sem caminho ou senha."
    );
  return {
    serverUrl: url.origin,
    apiKey: key.value.trim(),
    suitableOrigin,
    modules: {
      kds: { enabled: enabled.checked },
      stock: {
        enabled: stockEnabled.checked,
        checkTotal: stockCheckTotal.checked,
        blockAccounts: stockBlockAccounts.checked,
      },
    },
  };
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  save.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "suitable:configure",
      config: configuration(),
    });
    if (!result?.ok) throw new Error(result?.error || reloadMessage);
    notify(
      "Configurações salvas neste navegador. Não é necessário manter o Suitable aberto."
    );
  } catch (error) {
    notify(error.message, true);
    showArea("global");
  } finally {
    save.disabled = false;
  }
});
activate.addEventListener("click", async () => {
  try {
    if (!form.reportValidity()) return;
    const config = configuration();
    if (!currentTab?.url)
      throw new Error("Abra a extensão na aba do Suitable para ativar.");
    const url = new URL(currentTab.url);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Abra a aba online do Suitable para ativar.");
    if (!enabled.checked)
      throw new Error("Habilite a integração KDS antes de ativar.");
    config.suitableOrigin = url.origin;
    const origins = [...new Set([`${config.serverUrl}/*`, `${url.origin}/*`])];
    save.disabled = activate.disabled = true;
    notify("Salvando configurações e solicitando acesso…");
    // Start both in the user gesture. The worker persists even if the prompt closes the popup.
    const saving = chrome.runtime.sendMessage({
      type: "suitable:configure",
      tabId: currentTab.id,
      config,
    });
    const granting = chrome.permissions.request({ origins });
    const [saved, granted] = await Promise.all([saving, granting]);
    if (!saved?.ok) throw new Error(saved?.error || reloadMessage);
    suitableOrigin = url.origin;
    site.textContent = suitableOrigin;
    if (!granted)
      throw new Error(
        "Configurações salvas. Permita acesso aos sites para ativar a integração."
      );
    const result = await chrome.runtime.sendMessage({
      type: "suitable:activate",
      tabId: currentTab.id,
    });
    if (!result?.ok) throw new Error(result?.error || reloadMessage);
    notify(result.message);
  } catch (error) {
    notify(error.message, true);
  } finally {
    save.disabled = activate.disabled = false;
  }
});
