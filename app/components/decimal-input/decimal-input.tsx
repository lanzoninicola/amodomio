import { cn } from "~/lib/utils";

type Props = {
  value: number;
  decimalScale?: number;
  className?: string;
};

export function DecimalInput({ value, decimalScale = 2, className }: Props) {
  const display = Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: decimalScale,
    maximumFractionDigits: decimalScale,
  });

  return (
    <input
      type="text"
      readOnly
      value={display}
      onChange={() => {}}
      className={cn(
        "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-right text-slate-700",
        className
      )}
    />
  );
}
