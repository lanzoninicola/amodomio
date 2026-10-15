const {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  safeStorage,
  Notification,
  screen,
  dialog,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createOvenPopup } = require("./oven-popup.cjs");
const { apiRequest } = require("./policy.cjs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "amodomio",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let window;
let compact = false;
let widget = false;
let widgetBounds;
let settingsWindow;
let normalBounds;
const entry = "amodomio://app/index.html";
const state = () => ({ compact, widget, alwaysOnTop: window.isAlwaysOnTop() });
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== entry
    )
      throw new Error("Origem não autorizada.");
    const result = handler(...args);
    if (channel.startsWith("window:"))
      window.webContents.send("window:changed", state());
    return result;
  });
}
function secureStorageAvailable() {
  return (
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" ||
      safeStorage.getSelectedStorageBackend() !== "basic_text")
  );
}
let temporaryToken = null;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId("com.amodomio.desktop");
      const webRoot = path.join(__dirname, "web");
      protocol.handle("amodomio", async (request) => {
        const url = new URL(request.url);
        if (url.host !== "app") return new Response("", { status: 403 });
        const file = path.resolve(
          webRoot,
          "." + decodeURIComponent(url.pathname)
        );
        if (!file.startsWith(webRoot + path.sep))
          return new Response("", { status: 403 });
        const response = await net.fetch(pathToFileURL(file).href);
        const headers = new Headers(response.headers);
        headers.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'"
        );
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      });
      const tokenFile = path.join(app.getPath("userData"), "session.enc");
      handle("session:get", async () => {
        if (!secureStorageAvailable()) return temporaryToken;
        try {
          return safeStorage.decryptString(await fs.readFile(tokenFile));
        } catch {
          return null;
        }
      });
      handle("session:set", async (token) => {
        if (typeof token !== "string" || token.length > 8192)
          throw new Error("Sessão inválida.");
        if (!secureStorageAvailable()) {
          temporaryToken = token;
          return;
        }
        await fs.writeFile(tokenFile, safeStorage.encryptString(token), {
          mode: 0o600,
        });
      });
      handle("session:clear", async () => {
        temporaryToken = null;
        await fs.rm(tokenFile, { force: true });
      });
      handle("api:request", async (input) => {
        const { url, method } = apiRequest(input);
        const response = await net.fetch(url, {
          method,
          body: input.body,
          redirect: "error",
          credentials: "omit",
          signal: AbortSignal.timeout(15000),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
          },
        });
        return { status: response.status, body: await response.text() };
      });
      handle("window:state", state);
      handle("window:top", (value) => {
        if (typeof value !== "boolean") throw new Error("Valor inválido");
        window.setAlwaysOnTop(value);
        return state();
      });
      function leaveWidget() {
        if (!widget) return;
        widget = false;
        window.setMinimumSize(400, 560);
        if (widgetBounds) window.setBounds(widgetBounds);
      }
      handle("window:widget", (value) => {
        if (typeof value !== "boolean") throw new Error("Valor inválido");
        if (value && !widget) {
          widgetBounds = window.getBounds();
          window.unmaximize();
          window.setMinimumSize(360, 200);
          const area = screen.getDisplayMatching(widgetBounds).workArea;
          window.setBounds({
            x: area.x + Math.max(0, area.width - 360),
            y: area.y,
            width: 360,
            height: Math.round(area.height * 0.9),
          });
          widget = true;
        } else if (!value) leaveWidget();
        return state();
      });
      handle("feature:settings", async (feature) => {
        if (feature !== "kds")
          throw new Error("Funcionalidade não reconhecida.");
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.show();
          settingsWindow.focus();
          return;
        }
        settingsWindow = new BrowserWindow({
          parent: window,
          title: "Configurações do KDS",
          backgroundColor: "#000000",
          width: 420,
          height: 760,
          minWidth: 360,
          minHeight: 440,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        settingsWindow.setMenu(null);
        const settingsUrl = "amodomio://app/settings/index.html";
        settingsWindow.webContents.setWindowOpenHandler(() => ({
          action: "deny",
        }));
        settingsWindow.webContents.on("will-navigate", (event, url) => {
          if (url !== settingsUrl) event.preventDefault();
        });
        settingsWindow.on("closed", () => {
          settingsWindow = null;
        });
        await settingsWindow.loadURL(settingsUrl);
      });
      handle("window:compact", (value) => {
        if (typeof value !== "boolean") throw new Error("Valor inválido");
        leaveWidget();
        if (value !== compact) {
          if (value) {
            normalBounds = window.getBounds();
            const area = screen.getDisplayMatching(normalBounds).workArea;
            window.unmaximize();
            window.setBounds({
              x: area.x + Math.max(0, area.width - 480),
              y: area.y,
              width: Math.min(480, area.width),
              height: Math.min(820, area.height),
            });
          } else if (normalBounds) window.setBounds(normalBounds);
          compact = value;
        }
        return state();
      });
      const showOvenPopup = createOvenPopup(
        { BrowserWindow, ipcMain, screen },
        () => window
      );
      handle("orders:awaiting-oven", (numbers) => {
        if (
          !Array.isArray(numbers) ||
          !numbers.length ||
          !numbers.every((n) => n === null || Number.isFinite(n))
        )
          return;
        window.flashFrame(true);
        showOvenPopup(numbers);
        if (!Notification.isSupported()) return;
        const label = numbers
          .filter((n) => n !== null)
          .slice(0, 30)
          .map((n) => `#${n}`)
          .join(", ");
        const notification = new Notification({
          title:
            numbers.length === 1
              ? `Pedido ${label || "VL"} aguardando forno`
              : `${numbers.length} pedidos aguardando forno`,
          body:
            numbers.length === 1
              ? "Clique para abrir o KDS."
              : `${label || "Pedidos sem número"}. Clique para abrir o KDS.`,
          silent: true,
        });
        notification.on("click", () => {
          if (window.isDestroyed()) return;
          if (window.isMinimized()) window.restore();
          window.show();
          window.focus();
          window.webContents.send("kds:open");
        });
        notification.show();
      });
      handle("orders:notify", (numbers) => {
        if (
          !Array.isArray(numbers) ||
          !numbers.length ||
          !numbers.every((n) => n === null || Number.isFinite(n))
        )
          return;
        if (!Notification.isSupported()) return;
        const notification = new Notification({
          title:
            numbers.length === 1
              ? "Novo pedido no KDS"
              : `${numbers.length} novos pedidos`,
          silent: true,
          body:
            numbers
              .filter((n) => n !== null)
              .slice(0, 30)
              .map((n) => `#${n}`)
              .join(", ") || "Abra o KDS para visualizar.",
        });
        notification.on("click", () => {
          window.restore();
          window.show();
          window.focus();
        });
        notification.show();
      });
      window = new BrowserWindow({
        title: "Amodomio",
        width: 1100,
        height: 820,
        minWidth: 400,
        minHeight: 560,
        backgroundColor: "#000000",
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
          autoplayPolicy: "no-user-gesture-required",
        },
      });
      window.on("focus", () => window.flashFrame(false));
      window.setMenu(null);
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (url !== entry) event.preventDefault();
      });
      window.webContents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false)
      );
      await window.loadURL(entry);
    })
    .catch((error) => {
      dialog.showErrorBox("Amodomio", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
}
