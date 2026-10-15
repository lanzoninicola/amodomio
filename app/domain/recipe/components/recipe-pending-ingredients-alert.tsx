import { AlertTriangle } from "lucide-react";

export function RecipePendingIngredientsAlert({
  remaining,
}: {
  remaining: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed left-1/2 top-4 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
    >
      {remaining === 1 || remaining === 2 ? (
        <div
          className={`relative flex items-center justify-center gap-4 rounded-2xl border-2 px-5 py-4 text-xl font-extrabold shadow-2xl sm:px-8 sm:py-5 sm:text-3xl ${
            remaining === 1
              ? "border-red-400 bg-red-600 text-white ring-4 ring-red-500/30 shadow-red-500/40"
              : "border-amber-400 bg-amber-400 text-slate-950 ring-4 ring-amber-400/30 shadow-amber-400/30"
          }`}
        >
          <span
            aria-hidden="true"
            className="absolute -inset-1 rounded-2xl border-2 border-current opacity-40 motion-safe:animate-pulse"
          />
          <AlertTriangle
            aria-hidden="true"
            className="h-8 w-8 shrink-0 motion-safe:animate-bounce motion-safe:[animation-duration:1.8s] sm:h-10 sm:w-10"
          />
          <span>
            {remaining === 1 ? "Falta 1 ingrediente" : "Faltam 2 ingredientes"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
