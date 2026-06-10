import { useNavigation } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface RouteProgressBarProps {
  cnContainer?: string;
  showBlockingOverlay?: boolean;
}

export default function RouteProgressBar({
  cnContainer,
  showBlockingOverlay = false,
}: RouteProgressBarProps) {
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const isPageLoading = navigation.state === "loading" && !navigation.formData;
  const [visible, setVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const startedAtRef = useRef<number>(0);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayStartedAtRef = useRef<number>(0);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }

    if (showBlockingOverlay && isPageLoading && !overlayVisible) {
      overlayTimeoutRef.current = setTimeout(() => {
        overlayStartedAtRef.current = Date.now();
        setOverlayVisible(true);
      }, 180);

      return () => {
        if (overlayTimeoutRef.current) {
          clearTimeout(overlayTimeoutRef.current);
        }
      };
    }

    if (showBlockingOverlay && isPageLoading) return;

    if (!overlayVisible) return;

    const elapsed = Date.now() - overlayStartedAtRef.current;
    const waitMs = Math.max(0, 320 - elapsed);

    overlayTimeoutRef.current = setTimeout(() => {
      setOverlayVisible(false);
    }, waitMs);

    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, [isPageLoading, overlayVisible, showBlockingOverlay]);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "fixed left-0 top-0 h-1.5 transition-[width,opacity] duration-200 pointer-events-none",
          visible ? "opacity-100" : "opacity-0",
          cnContainer
        )}
        style={{
          width: `${width}%`,
          zIndex: 2147483647,
          backgroundColor: "#111111",
        }}
      />

      {showBlockingOverlay ? (
        <div
          aria-hidden={!overlayVisible}
          aria-busy={overlayVisible}
          aria-live="polite"
          className={cn(
            "fixed inset-0 flex items-center justify-center bg-white/55 p-4 backdrop-blur-[2px] transition-opacity duration-200",
            overlayVisible
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
          style={{ zIndex: 2147483646 }}
        >
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-4 shadow-xl">
            <Loader2
              className="h-5 w-5 animate-spin text-slate-700"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Carregando página...
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Aguarde um instante
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
