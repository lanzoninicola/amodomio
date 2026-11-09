const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createOvenPopup } = require("./oven-popup.cjs");
test("cada pedido abre seu alerta no topo, sem sobreposição, com fechamento independente", async () => {
  const handlers = new Map();
  const windows = [];
  const main = {
    getBounds: () => ({}),
    once() {},
    removeListener() {},
    isDestroyed: () => false,
    isMinimized: () => true,
    restore() {
      this.restored = true;
    },
    show() {},
    focus() {
      this.focused = true;
    },
    webContents: {
      send(channel) {
        main.channel = channel;
      },
    },
  };
  class Window {
    constructor(options) {
      this.options = options;
      this.events = {};
      windows.push(this);
      this.webContents = {
        mainFrame: { url: "amodomio://app/oven-alert/index.html" },
        setWindowOpenHandler() {},
        on() {},
        send: (_channel, numbers) => {
          this.numbers = [...numbers];
        },
      };
    }
    setBounds(bounds) {
      this.bounds = bounds;
    }
    setMenu() {}
    on(event, fn) {
      this.events[event] = fn;
    }
    async loadURL() {}
    showInactive() {
      this.inactive = true;
    }
    isDestroyed() {
      return !!this.destroyed;
    }
    close() {
      this.destroyed = true;
      this.events.closed();
    }
    destroy() {
      this.close();
    }
  }
  const show = createOvenPopup(
    {
      BrowserWindow: Window,
      ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
      screen: {
        getDisplayMatching: () => ({
          workArea: { x: 0, y: 0, width: 1920, height: 1080 },
        }),
      },
    },
    () => main
  );
  show([39]);
  const popup = windows[0];
  const event = {
    sender: popup.webContents,
    senderFrame: popup.webContents.mainFrame,
  };
  assert.equal(popup.options.alwaysOnTop, true);
  assert.equal(popup.options.show, false);
  assert.equal(popup.options.webPreferences.nodeIntegration, false);
  popup.events["ready-to-show"]();
  assert.equal(popup.inactive, true);
  show([40, null]);
  assert.equal(windows.length, 3);
  assert.deepEqual(handlers.get("oven-alert:get")(event), [39]);
  for (let i = 0; i < windows.length; i++) {
    const current = windows[i];
    assert.deepEqual(
      handlers.get("oven-alert:get")({
        sender: current.webContents,
        senderFrame: current.webContents.mainFrame,
      }),
      [[39], [40], [null]][i]
    );
    assert.equal(current.options.alwaysOnTop, true);
    if (i > 0)
      assert.ok(
        current.bounds.y >=
          windows[i - 1].bounds.y + windows[i - 1].bounds.height
      );
  }
  assert.throws(
    () => handlers.get("oven-alert:action")({ sender: {} }, "open"),
    /Origem/
  );
  assert.throws(
    () => handlers.get("oven-alert:action")(event, "invalid"),
    /Ação/
  );
  handlers.get("oven-alert:action")(event, "dismiss");
  assert.equal(main.focused, undefined);
  show([41]);
  assert.equal(windows[1].destroyed, undefined);
  assert.equal(windows[2].destroyed, undefined);
  const next = windows[3];
  const nextEvent = {
    sender: next.webContents,
    senderFrame: next.webContents.mainFrame,
  };
  assert.deepEqual(handlers.get("oven-alert:get")(nextEvent), [41]);
  assert.throws(() => handlers.get("oven-alert:get")(event), /Origem/);
  handlers.get("oven-alert:action")(nextEvent, "open");
  assert.equal(main.restored, true);
  assert.equal(main.focused, true);
  assert.equal(main.channel, "kds:open");
  show([42, 43]);
  const active = windows.filter((item) => !item.destroyed);
  assert.equal(active.length, 4);
  assert.ok(active[3].bounds.x < active[0].bounds.x);
  assert.ok(active[3].bounds.x + active[3].bounds.width <= active[0].bounds.x);
});
