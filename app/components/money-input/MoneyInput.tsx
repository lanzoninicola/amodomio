import { useEffect, useState } from "react";
import type { DecimalLike } from "../../domain/kds/types";
import { cn } from "~/lib/utils";
type Props = { name: string; defaultValue?: DecimalLike | null; placeholder?: string; className?: string; disabled?: boolean; };
function toCents(v?: DecimalLike | null) {
  const n = v == null ? 0 : typeof v === "number" ? v : Number((v as any)?.toString?.() ?? `${v}`);
  return Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 100));
}
export function MoneyInput({ name, defaultValue, placeholder, className, disabled = false, readOnly = false, ...props }: Props) {
  const [cents, setCents] = useState<number>(toCents(defaultValue));
  useEffect(() => setCents(toCents(defaultValue)), [defaultValue]);
  const display = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    const k = e.key;
    if (k === "Enter") return;
    if (k === "Backspace") { e.preventDefault(); setCents((c) => Math.floor(c / 10)); return; }
    if (k === "Delete") { e.preventDefault(); setCents(0); return; }
    if (/^\d$/.test(k)) { e.preventDefault(); setCents((c) => (c * 10 + Number(k)) % 1000000000); return; }
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
