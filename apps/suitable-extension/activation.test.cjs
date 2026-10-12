const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
function setup(saved = {}) {
  const state = {
    saved,
    granted: false,
    scripts: [],
    injections: [],
    added: null,
    removed: null,
    installed: null,
  };
  let listener;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  vm.runInNewContext(readFileSync(`${__dirname}/activation.js`, "utf8"), {
    chrome: {
      runtime: {
        id: "extension-id",
        getURL: (path) => `chrome-extension://extension-id/${path}`,
        onInstalled: {
          addListener(fn) {
            state.installed = fn;
          },
        },
        onMessage: {
          addListener(fn) {
            listener = fn;
          },
        },
      },
      storage: {
        local: {
          async get() {
            return clone(state.saved);
          },
          async set(value) {
            Object.assign(state.saved, clone(value));
          },
        },
      },
      permissions: {
        async contains() {
          return state.granted;
        },
        onAdded: {
          addListener(fn) {
            state.added = fn;
          },
        },
        onRemoved: {
          addListener(fn) {
            state.removed = fn;
          },
        },
      },
      tabs: {
        async get(id) {
          return { id, url: state.saved.suitableOrigin + "/pedido" };
        },
      },
      scripting: {
        async getRegisteredContentScripts() {
          return clone(state.scripts);
        },
        async registerContentScripts(scripts) {
          state.scripts.push(...clone(scripts));
        },
        async updateContentScripts(scripts) {
          state.scripts = clone(scripts);
        },
        async unregisterContentScripts() {
          state.scripts = [];
        },
        async executeScript(input) {
          state.injections.push(clone(input));
        },
      },
    },
    URL,
  });
  state.send = (
    message,
    sender = {
      id: "extension-id",
      url: "chrome-extension://extension-id/popup.html",
    }
  ) => new Promise((resolve) => listener(message, sender, resolve));
  return state;
}
const configure = {
  type: "suitable:configure",
  tabId: 7,
  config: {
    serverUrl: "https://kds.test",
    apiKey: "test-key",
    suitableOrigin: "https://suitable.test",
  },
};
test("saves configuration before permission approval; onAdded activates independently of the popup", async () => {
  const worker = setup();
  const result = await worker.send(configure);
  assert.equal(result.state, "waiting");
  assert.equal(worker.saved.serverUrl, configure.config.serverUrl);
  assert.equal(worker.saved.apiKey, configure.config.apiKey);
  assert.equal(worker.saved.suitableOrigin, configure.config.suitableOrigin);
  assert.equal(worker.scripts.length, 0);
  // The popup is now gone: only a browser permission event reaches the worker.
  worker.granted = true;
  await worker.added();
  assert.equal(worker.saved.activationStatus.state, "active");
  assert.equal(worker.scripts.length, 1);
  assert.deepEqual(worker.scripts[0].matches, ["https://suitable.test/*"]);
  assert.deepEqual(worker.injections[0], {
    target: { tabId: 7 },
    files: ["parser.js", "content.js"],
  });
});
test("a restarted worker recovers stored configuration and injects on reopen", async () => {
  const first = setup();
  await first.send(configure);
  const next = setup(first.saved);
  next.granted = true;
  const result = await next.send({ type: "suitable:activate", tabId: 8 });
  assert.equal(result.state, "active");
  assert.equal(next.saved.apiKey, "test-key");
  assert.equal(next.injections[0].target.tabId, 8);
});
test("denying/revoking permissions retains the entered server and key", async () => {
  const worker = setup();
  await worker.send(configure);
  await worker.removed();
  assert.equal(worker.saved.apiKey, "test-key");
  assert.equal(worker.saved.activationStatus.state, "waiting");
});
test("content scripts cannot change server or credentials", async () => {
  const worker = setup();
  const result = await worker.send(configure, {
    id: "extension-id",
    tab: { id: 7 },
    url: "https://suitable.test/pedido",
  });
  assert.equal(result.ok, false);
  assert.equal(worker.saved.apiKey, undefined);
});
test("a repeated activation updates registration instead of duplicating it", async () => {
  const worker = setup();
  worker.granted = true;
  await worker.send(configure);
  await worker.send({ type: "suitable:activate", tabId: 7 });
  assert.equal(worker.scripts.length, 1);
});

test("saves global configuration without an open tab or Suitable origin", async () => {
  const worker = setup();
  const result = await worker.send({
    type: "suitable:configure",
    config: {
      serverUrl: "https://amodomio.test",
      apiKey: "global-key",
      modules: { kds: { enabled: true } },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.state, "saved");
  assert.equal(worker.saved.serverUrl, "https://amodomio.test");
  assert.equal(worker.saved.apiKey, "global-key");
  assert.equal(worker.saved.suitableOrigin, null);
  assert.equal(worker.saved.modules.kds.enabled, true);
  assert.equal(worker.saved.configurationVersion, 2);
  assert.equal(worker.scripts.length, 0);
  assert.equal(worker.injections.length, 0);
});
test("preserves the linked site and other modules when saving globals", async () => {
  const worker = setup({
    suitableOrigin: "https://suitable.test",
    modules: { future: { enabled: true, choice: "keep" } },
  });
  await worker.send({
    type: "suitable:configure",
    config: {
      serverUrl: "https://amodomio.test",
      apiKey: "global-key",
      modules: { kds: { enabled: false } },
    },
  });
  assert.equal(worker.saved.suitableOrigin, "https://suitable.test");
  assert.deepEqual(worker.saved.modules.future, {
    enabled: true,
    choice: "keep",
  });
  assert.equal(worker.saved.modules.kds.enabled, false);
});
test("disabling KDS unregisters its scripts without deleting global credentials", async () => {
  const worker = setup();
  worker.granted = true;
  await worker.send(configure);
  await worker.send({
    type: "suitable:configure",
    config: { ...configure.config, modules: { kds: { enabled: false } } },
  });
  assert.equal(worker.scripts.length, 0);
  assert.equal(worker.saved.apiKey, "test-key");
  assert.equal(worker.saved.activationStatus.state, "disabled");
});
