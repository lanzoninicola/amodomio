import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { KdsOrder } from "../kds/types";

const TOKEN_KEY = "amodomio.kds.token";
const API_URL_KEY = "amodomio.kds.api-url";
const CACHE_PREFIX = "amodomio.kds.orders.";

export const sessionStorage = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  getApiUrl: () => AsyncStorage.getItem(API_URL_KEY),
  setApiUrl: (url: string) => AsyncStorage.setItem(API_URL_KEY, url),
  async getCachedOrders(date: string): Promise<KdsOrder[]> {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${date}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as KdsOrder[];
    } catch {
      return [];
    }
  },
  setCachedOrders: (date: string, orders: KdsOrder[]) =>
    AsyncStorage.setItem(`${CACHE_PREFIX}${date}`, JSON.stringify(orders)),
};
