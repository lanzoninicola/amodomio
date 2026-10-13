const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("ovenAlert", {
  get: () => ipcRenderer.invoke("oven-alert:get"),
  action: (action) => ipcRenderer.invoke("oven-alert:action", action),
  onChanged: (callback) =>
    ipcRenderer.on("oven-alert:changed", (_event, numbers) =>
      callback(numbers)
    ),
});
