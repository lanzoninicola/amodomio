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
const { apiRequest } = require("./policy.cjs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "amodomio",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let window;
let compact = false;
let normalBounds;
const entry = "amodomio://app/index.html";
const state = () => ({ compact, alwaysOnTop: window.isAlwaysOnTop() });
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== entry
    )
      throw new Error("Origem não autorizada.");
    return handler(...args);
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
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'"
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
      handle("window:compact", (value) => {
        if (typeof value !== "boolean") throw new Error("Valor inválido");
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
        backgroundColor: "#ffffff",
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
        },
      });
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
