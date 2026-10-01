export type DesktopWindowState = { compact: boolean; alwaysOnTop: boolean };
export type DesktopBridge = {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
  request(input: {
    baseUrl: string;
    path: string;
    method: string;
    body?: string;
    token?: string | null;
  }): Promise<{ status: number; body: string }>;
  notify(numbers: Array<number | null>): Promise<void>;
  getWindowState(): Promise<DesktopWindowState>;
  setAlwaysOnTop(value: boolean): Promise<DesktopWindowState>;
  setCompact(value: boolean): Promise<DesktopWindowState>;
};
export const desktop: DesktopBridge | undefined = undefined;
