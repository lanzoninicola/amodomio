import type { KdsOrder } from "../kds/types";
import { desktop } from "../platform/desktop";
// Browser preview tokens last only for this tab; Electron encrypts them via the OS.
const TOKEN_KEY = "amodomio.session.token";
const API_URL_KEY = "amodomio.kds.api-url";
const CACHE_PREFIX = "amodomio.kds.orders.";
export const sessionStorage = {
  getToken: async () =>
    desktop ? desktop.getToken() : window.sessionStorage.getItem(TOKEN_KEY),
  setToken: async (token: string) => {
    if (desktop) await desktop.setToken(token);
    else window.sessionStorage.setItem(TOKEN_KEY, token);
  },
  clearToken: async () => {
    if (desktop) await desktop.clearToken();
    else window.sessionStorage.removeItem(TOKEN_KEY);
  },
  getApiUrl: async () => localStorage.getItem(API_URL_KEY),
  setApiUrl: async (url: string) => {
    localStorage.setItem(API_URL_KEY, url);
  },
  async getCachedOrders(date: string): Promise<KdsOrder[]> {
    try {
      const value = JSON.parse(
        localStorage.getItem(`${CACHE_PREFIX}${date}`) || "[]"
      );
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  },
  async setCachedOrders(date: string, orders: KdsOrder[]) {
    try {
      localStorage.setItem(`${CACHE_PREFIX}${date}`, JSON.stringify(orders));
    } catch {
      /* Cache exhaustion must not interrupt live orders. */
    }
  },
};
