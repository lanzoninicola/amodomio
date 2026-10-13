const path = require("node:path");
const url = "amodomio://app/oven-alert/index.html";
function createOvenPopup({ BrowserWindow, ipcMain, screen }, getMainWindow) {
  const popups = new Map();
  function arrange() {
    const area = screen.getDisplayMatching(
      getMainWindow().getBounds()
    ).workArea;
    const gap = 12;
    const rows = Math.max(1, Math.floor((area.height - gap) / (300 + gap)));
    const columns = Math.max(1, Math.ceil(popups.size / rows));
    const width = Math.min(
      440,
      Math.floor((area.width - gap * (columns + 1)) / columns)
    );
    const height = Math.min(300, area.height - gap * 2);
    let index = 0;
    for (const popup of popups.keys()) {
      const column = Math.floor(index / rows);
      const row = index % rows;
      popup.setBounds({
        x: area.x + area.width - gap - width - column * (width + gap),
        y: area.y + gap + row * (height + gap),
        width,
        height,
      });
      index++;
    }
  }
  function authorized(event) {
    const popup = [...popups.keys()].find(
      (candidate) => event.sender === candidate.webContents
    );
    if (
      !popup ||
      event.senderFrame !== popup.webContents.mainFrame ||
      event.senderFrame.url !== url
    )
      throw new Error("Origem não autorizada.");
    return popup;
  }
  ipcMain.handle("oven-alert:get", (event) => {
    const popup = authorized(event);
    return [popups.get(popup)];
  });
  ipcMain.handle("oven-alert:action", (event, action) => {
    const popup = authorized(event);
    if (action !== "open" && action !== "dismiss")
      throw new Error("Ação inválida.");
    const main = getMainWindow();
    if (action === "open" && !main.isDestroyed()) {
      if (main.isMinimized()) main.restore();
      main.show();
      main.focus();
      main.webContents.send("kds:open");
    }
    popup.close();
  });
  return function show(numbers) {
    for (const number of numbers) {
      const area = screen.getDisplayMatching(
        getMainWindow().getBounds()
      ).workArea;
      const popup = new BrowserWindow({
        title: `Pedido ${
          number === null ? "VL" : "#" + number
        } — Aguardando forno`,
        width: 440,
        height: 300,
        x: area.x + Math.max(0, area.width - 420),
        y: area.y + 20,
        show: false,
        alwaysOnTop: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        backgroundColor: "#ffba52",
        webPreferences: {
          preload: path.join(__dirname, "oven-alert-preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      popups.set(popup, number);
      arrange();
      const current = popup;
      current.setMenu(null);
      current.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      current.webContents.on("will-navigate", (event, target) => {
        if (target !== url) event.preventDefault();
      });
      current.on("ready-to-show", () => current.showInactive());
      const main = getMainWindow();
      const closeWithMain = () => {
        if (!current.isDestroyed()) current.destroy();
      };
      main.once("closed", closeWithMain);
      current.on("closed", () => {
        main.removeListener("closed", closeWithMain);
        popups.delete(current);
        if (!main.isDestroyed()) arrange();
      });
      current.loadURL(url).catch(() => {
        if (!current.isDestroyed()) current.destroy();
      });
    }
  };
}
module.exports = { createOvenPopup };
