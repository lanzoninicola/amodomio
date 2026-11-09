import { Minus, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";

export function RecipeFontSizeControls({
  value,
  onChange,
  dark = false,
}: {
  value: number;
  onChange: (value: number) => void;
  dark?: boolean;
}) {
  const buttonClass = dark
    ? "h-12 w-12 border-slate-600 bg-slate-900 p-0 text-white hover:bg-slate-800 hover:text-white"
    : "h-11 w-11 p-0";
  return (
    <div
      role="group"
      aria-label="Tamanho do texto dos ingredientes"
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border p-1 ${
        dark ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <Button
        type="button"
        variant="outline"
        disabled={value <= 80}
        aria-label="Diminuir tamanho do texto dos ingredientes"
        onClick={() => onChange(Math.max(80, value - 10))}
        className={buttonClass}
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </Button>
      <span
        role="status"
        aria-live="polite"
        className={`min-w-14 text-center font-mono text-sm tabular-nums ${
          dark ? "text-slate-200" : "text-slate-600"
        }`}
      >
        {value}%
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={value >= 150}
        aria-label="Aumentar tamanho do texto dos ingredientes"
        onClick={() => onChange(Math.min(150, value + 10))}
        className={buttonClass}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
