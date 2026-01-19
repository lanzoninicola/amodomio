import { useState, useEffect } from "react";

const useStoreOpeningStatus = () => {
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/store-opening-status");
        if (!response.ok) return;
        const data = await response.json();
        if (!isMounted) return;
        setIsStoreOpen(Boolean(data?.isOpen));
      } catch {
        if (!isMounted) return;
        setIsStoreOpen(false);
      }
    };

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return isStoreOpen;
};

export default useStoreOpeningStatus;
