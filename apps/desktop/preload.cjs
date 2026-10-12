const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("amodomioDesktop", {
  onOpenKds: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("kds:open", listener);
    return () => ipcRenderer.removeListener("kds:open", listener);
  },
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:changed", listener);
    return () => ipcRenderer.removeListener("window:changed", listener);
  },
  setWidget: (value) => ipcRenderer.invoke("window:widget", value),
  openFeatureSettings: (feature) =>
    ipcRenderer.invoke("feature:settings", feature),
  getToken: () => ipcRenderer.invoke("session:get"),
  setToken: (token) => ipcRenderer.invoke("session:set", token),
  clearToken: () => ipcRenderer.invoke("session:clear"),
  request: (input) => ipcRenderer.invoke("api:request", input),
  notify: (numbers) => ipcRenderer.invoke("orders:notify", numbers),
  notifyAwaitingOven: (numbers) =>
    ipcRenderer.invoke("orders:awaiting-oven", numbers),
  getWindowState: () => ipcRenderer.invoke("window:state"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("window:top", value),
  setCompact: (value) => ipcRenderer.invoke("window:compact", value),
});
