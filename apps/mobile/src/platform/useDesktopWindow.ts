import { useEffect, useState } from "react";
import { desktop, type DesktopWindowState } from "./desktop";
export function useDesktopWindow() {
  const [state, setState] = useState<DesktopWindowState>({
    compact: false,
    alwaysOnTop: false,
    widget: false,
  });
  useEffect(() => {
    let alive = true;
    desktop
      ?.getWindowState()
      .then((value) => {
        if (alive) setState(value);
      })
      .catch(() => {});
    const unsubscribe = desktop?.onWindowState((value) => {
      if (alive) setState(value);
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);
  return state;
}
