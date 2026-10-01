import type { DesktopBridge } from "./desktop";
export const desktop = (
  globalThis as typeof globalThis & { amodomioDesktop?: DesktopBridge }
).amodomioDesktop;
