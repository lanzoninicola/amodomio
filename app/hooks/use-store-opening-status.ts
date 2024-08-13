import { useEnv } from "./use-env";

import { useState, useEffect } from "react";

const useStoreOpeningStatus = () => {
  const ENV = useEnv();

  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(false);

  useEffect(() => {
    const storeOpenDays = ENV.STORE_OPENING_CONFIG.OPENING_DAYS || [];
    const storeOpenHour = ENV.STORE_OPENING_CONFIG.OPENING_HOUR || 1800;
    const storeCloseHour = ENV.STORE_OPENING_CONFIG.CLOSING_HOUR || 2200;

    console.log({ storeOpenDays });

    if (storeOpenDays) {
      // Get the current day of the week (0 = Sunday, 6 = Saturday)
      const now = new Date();
      const today = now.getDay();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const nowTime = parseInt(`${hour}${minutes}`);

      // Determine if the store is open today
      const isOpen =
        storeOpenDays[today] === 1 &&
        nowTime >= storeOpenHour &&
        nowTime < storeCloseHour;

      setIsStoreOpen(isOpen);
    } else {
      // if no store opening config is provided, assume store is always open
      setIsStoreOpen(true);
    }
  }, []);

  return isStoreOpen;
};

export default useStoreOpeningStatus;
