import { useEffect, useState } from "react";
import type { DecimalLike } from "../../domain/kds/types";
import { cn } from "~/lib/utils";
type Props = {
  name: string;
  defaultValue?: DecimalLike | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onValueChange?: (value: number) => void;
};
function toCents(v?: DecimalLike | null) {
  const n = v == null ? 0 : typeof v === "number" ? v : Number((v as any)?.toString?.() ?? `${v}`);
  return Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 100));
}
export function MoneyInput({ name, defaultValue, placeholder, className, disabled = false, readOnly = false, onValueChange, ...props }: Props) {
  const [cents, setCents] = useState<number>(toCents(defaultValue));
  useEffect(() => setCents(toCents(defaultValue)), [defaultValue]);
  const display = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled || readOnly) return;
    const k = e.key;
    if (k === "Enter") return;
    if (k === "Backspace") {
      e.preventDefault();
      setCents((c) => {
        const next = Math.floor(c / 10);
        onValueChange?.(next / 100);
        return next;
      });
      return;
    }
    if (k === "Delete" || k === "Del" || e.code === "Delete") {
      e.preventDefault();
      setCents(() => {
        const next = 0;
        onValueChange?.(next / 100);
        return next;
      });
      return;
    }
    if (/^\d$/.test(k)) {
      e.preventDefault();
      setCents((c) => {
        const next = (c * 10 + Number(k)) % 1000000000;
        onValueChange?.(next / 100);
        return next;
      });
      return;
    }
    if (k === "Tab" || k.startsWith("Arrow") || k === "Home" || k === "End") return;
    e.preventDefault();
  }
  return (<div className="relative">
    <input type="text" inputMode="numeric" value={display} onKeyDown={onKeyDown} onChange={() => { }} disabled={disabled}
      readOnly={readOnly || false}
      className={
        cn(
          "w-24 h-9 border rounded px-2 py-1 text-right",
          disabled ? "bg-gray-50 text-gray-400" : "",
          readOnly && "border-none",
          className
        )
      }
      placeholder={placeholder}
      {...props}
    />
    <input type="hidden" name={name} value={(cents / 100).toFixed(2)} />
  </div>);
}
