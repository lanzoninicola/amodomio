const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
test("desktop mantém janela independente, restringe IPC e serve assets com CSP", async () => {
  const handlers = new Map();
  let instance, serve, failure;
  const notifications = [];
  const sent = [];
  class Notification {
    static isSupported() {
      return true;
    }
    constructor(options) {
      this.options = options;
      this.events = {};
      notifications.push(this);
    }
    on(event, callback) {
      this.events[event] = callback;
    }
    show() {
      this.shown = true;
    }
  }
  class BrowserWindow {
    constructor(options) {
      instance = this;
      this.options = options;
      this.bounds = { x: 0, y: 0, width: 1100, height: 820 };
      this.top = false;
      this.webContents = {
        mainFrame: { url: "amodomio://app/index.html" },
        setWindowOpenHandler: (fn) => {
          this.popup = fn;
        },
        on() {},
        send(channel) {
          sent.push(channel);
        },
        session: { setPermissionRequestHandler() {} },
      };
    }
    setMenu() {}
    isDestroyed() {
      return false;
    }
    show() {
      this.shown = true;
    }
    focus() {
      this.focused = true;
    }
    isMinimized() {
      return true;
    }
    restore() {
      this.restored = true;
    }
    setMinimumSize(w, h) {
      this.minimum = [w, h];
    }
    on(event, callback) {
      (this.events ??= {})[event] = callback;
    }
    flashFrame(value) {
      this.flashing = value;
    }
    async loadURL(url) {
      this.url = url;
    }
    isAlwaysOnTop() {
      return this.top;
    }
    setAlwaysOnTop(value) {
      this.top = value;
    }
    getBounds() {
      return this.bounds;
    }
    setBounds(value) {
      this.bounds = value;
    }
    unmaximize() {}
  }
  const electron = {
    app: {
      requestSingleInstanceLock: () => true,
      on() {},
      whenReady: () => Promise.resolve(),
      setAppUserModelId() {},
      getPath: () => "/tmp",
      quit() {},
    },
    BrowserWindow,
    ipcMain: { handle: (key, fn) => handlers.set(key, fn) },
    protocol: {
      registerSchemesAsPrivileged() {},
      handle: (_, fn) => {
        serve = fn;
      },
    },
    net: {
      fetch: async () =>
        new Response("asset", {
          headers: { "Content-Type": "text/javascript" },
        }),
    },
    safeStorage: { isEncryptionAvailable: () => false },
    Notification,
    screen: {
      getDisplayMatching: () => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      }),
    },
    dialog: {
      showErrorBox: (_, message) => {
        failure = message;
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8"),
    {
      require: (name) =>
        name === "electron"
          ? electron
          : name === "./oven-popup.cjs"
          ? { createOvenPopup: () => () => {} }
          : require(name),
      __dirname,
      process,
      URL,
      Response,
      Headers,
      AbortSignal,
    }
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failure, undefined);
  const event = {
    sender: instance.webContents,
    senderFrame: instance.webContents.mainFrame,
  };
  assert.equal(instance.options.webPreferences.nodeIntegration, false);
  assert.equal(instance.options.webPreferences.backgroundThrottling, false);
  assert.equal(instance.popup().action, "deny");
  assert.throws(() => handlers.get("session:get")({ sender: {} }), /Origem/);
  assert.throws(
    () =>
      handlers.get("session:get")({
        ...event,
        senderFrame: { url: instance.url },
      }),
    /Origem/
  );
  assert.equal(handlers.get("window:top")(event, true).alwaysOnTop, true);
  handlers.get("window:compact")(event, true);
  assert.equal(instance.bounds.width, 480);
  handlers.get("window:compact")(event, false);
  assert.equal(instance.bounds.width, 1100);
  handlers.get("window:widget")(event, true);
  assert.equal(instance.bounds.width, 360);
  assert.equal(instance.bounds.height, 972);
  assert.equal(handlers.get("window:state")(event).widget, true);
  handlers.get("window:widget")(event, false);
  assert.equal(instance.bounds.width, 1100);
  assert.equal(instance.bounds.height, 820);
  assert.equal(instance.minimum[1], 560);

  await handlers.get("session:set")(event, "temporary-token");
  assert.equal(await handlers.get("session:get")(event), "temporary-token");
  assert.equal(
    (await serve({ url: "amodomio://evil/index.html" })).status,
    403
  );
  assert.equal(
    (await serve({ url: "amodomio://app/%2e%2e%2fsecret" })).status,
    403
  );
  const asset = await serve({ url: "amodomio://app/index.js" });
  assert.match(
    asset.headers.get("Content-Security-Policy"),
    /script-src 'self'/
  );
  assert.equal(await asset.text(), "asset");
  assert.throws(
    () => handlers.get("orders:awaiting-oven")({ sender: {} }, [39]),
    /Origem/
  );
  handlers.get("orders:awaiting-oven")(event, ["invalid"]);
  assert.equal(notifications.length, 0);
  handlers.get("orders:awaiting-oven")(event, [39]);
  assert.equal(instance.flashing, true);
  instance.events.focus();
  assert.equal(instance.flashing, false);
  const notification = notifications.at(-1);
  assert.equal(notification.options.title, "Pedido #39 aguardando forno");
  assert.equal(notification.options.silent, true);
  assert.equal(notification.shown, true);
  const bounds = instance.bounds;
  notification.events.click();
  assert.equal(instance.restored, true);
  assert.equal(instance.shown, true);
  assert.equal(instance.focused, true);
  assert.equal(sent.at(-1), "kds:open");
  assert.equal(instance.bounds, bounds);
  handlers.get("orders:awaiting-oven")(event, [39, 40]);
  assert.equal(
    notifications.at(-1).options.title,
    "2 pedidos aguardando forno"
  );
  assert.match(notifications.at(-1).options.body, /#39, #40/);
  Notification.isSupported = () => false;
  handlers.get("orders:awaiting-oven")(event, [41]);
  assert.equal(instance.flashing, true);
  const mainWindow = instance;
  await handlers.get("feature:settings")(event, "kds");
  assert.equal(instance.options.parent, mainWindow);
  assert.equal(instance.options.webPreferences.preload, undefined);
  assert.equal(instance.options.webPreferences.nodeIntegration, false);
  assert.equal(instance.url, "amodomio://app/settings/index.html");
  assert.throws(
    () =>
      handlers.get("session:get")({
        sender: instance.webContents,
        senderFrame: instance.webContents.mainFrame,
      }),
    /Origem/
  );
  const settings = instance;
  await handlers.get("feature:settings")(event, "kds");
  assert.equal(instance, settings);
});
