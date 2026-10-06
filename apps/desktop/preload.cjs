const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("amodomioDesktop", {
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:changed", listener);
    return () => ipcRenderer.removeListener("window:changed", listener);
  },
  setWidget: (value) => ipcRenderer.invoke("window:widget", value),
  openKdsSettings: () => ipcRenderer.invoke("kds:settings"),
  getToken: () => ipcRenderer.invoke("session:get"),
  setToken: (token) => ipcRenderer.invoke("session:set", token),
  clearToken: () => ipcRenderer.invoke("session:clear"),
  request: (input) => ipcRenderer.invoke("api:request", input),
  notify: (numbers) => ipcRenderer.invoke("orders:notify", numbers),
  getWindowState: () => ipcRenderer.invoke("window:state"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("window:top", value),
  setCompact: (value) => ipcRenderer.invoke("window:compact", value),
});
