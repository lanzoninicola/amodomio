const CLIENT_ID_STORAGE_KEY = "cardapio_client_id";

export const getOrCreateMenuItemInterestClientId = () => {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (stored) return stored;

  const generated =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `cid_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return generated;
};
