import qz from "qz-tray";
import { buildEscPosFoodLabel, type FoodLabelRecord, type LabelingSettings } from "../../../../shared/labeling/food-label";

let configured = false;

export async function printFoodLabel(label: FoodLabelRecord, settings: LabelingSettings) {
  if (!settings.qzHost || settings.qzHost === "localhost" || settings.qzHost === "127.0.0.1") {
    throw new Error("Configure o IP do computador com QZ Tray em labeling / qz.host.");
  }
  if (!configured) {
    qz.api.setWebSocketType(WebSocket as any);
    configured = true;
  }
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect({ host: settings.qzHost });
  }
  const printer = await qz.printers.find(settings.printerName);
  const config = qz.configs.create(printer, { encoding: "Cp850" });
  const data = buildEscPosFoodLabel(label, settings);
  for (let copy = 0; copy < label.copies; copy += 1) await qz.print(config, data);
}
