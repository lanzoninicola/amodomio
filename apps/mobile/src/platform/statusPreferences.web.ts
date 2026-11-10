export function subscribeStatusPreferences(callback: () => void) {
  const listener = (event: StorageEvent) => {
    if (
      event.key === "amodomio.desktop.kds.statuses" ||
      event.key === "amodomio.desktop.kds.view"
    )
      callback();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
