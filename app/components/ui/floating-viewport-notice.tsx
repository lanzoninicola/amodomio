import * as React from "react";

import { cn } from "@/lib/utils";

type FloatingViewportNoticeProps = {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
};

export function FloatingViewportNotice({
  visible,
  children,
  className,
  wrapperClassName,
}: FloatingViewportNoticeProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 transition-all duration-200",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        wrapperClassName,
      )}
    >
      <div
        className={cn(
          "rounded-xl border border-slate-200 bg-white/95 p-4 text-center text-xs font-semibold uppercase tracking-wide text-black shadow-xl backdrop-blur-sm",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
