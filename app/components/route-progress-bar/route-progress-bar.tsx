import { useNavigation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface RouteProgressBarProps {
  cnContainer?: string;
}

export default function RouteProgressBar({ cnContainer }: RouteProgressBarProps) {
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const startedAtRef = useRef<number>(0);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }

    if (isLoading) {
      startedAtRef.current = Date.now();
      setVisible(true);
      setWidth(35);

      const rampOne = setTimeout(() => setWidth(65), 120);
      const rampTwo = setTimeout(() => setWidth(85), 380);
      const rampThree = setTimeout(() => setWidth(92), 900);

      return () => {
        clearTimeout(rampOne);
        clearTimeout(rampTwo);
        clearTimeout(rampThree);
      };
    }

    if (!visible) return;

    const elapsed = Date.now() - startedAtRef.current;
    const minVisibleMs = 320;
    const waitMs = Math.max(0, minVisibleMs - elapsed);

    finishTimeoutRef.current = setTimeout(() => {
      setWidth(100);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 220);

      finishTimeoutRef.current = hideTimer;
    }, waitMs);

    return () => {
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
      }
    };
  }, [isLoading, visible]);

  return (
    <div
      aria-hidden
      className={cn(
        "fixed left-0 top-0 h-1.5 transition-[width,opacity] duration-200 pointer-events-none",
        visible ? "opacity-100" : "opacity-0",
        cnContainer
      )}
      style={{ width: `${width}%`, zIndex: 2147483647, backgroundColor: "#111111" }}
    />
  );
}
