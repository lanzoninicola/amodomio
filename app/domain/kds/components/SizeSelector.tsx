import { Badge } from "@/components/ui/badge";
import type { SizeCounts } from "../types";
import { defaultSizeCounts } from "../types";
export function SizeSelector({ counts, onChange, disabled }: { counts: SizeCounts; onChange: (next: SizeCounts) => void; disabled?: boolean; }) {
  function inc(k: keyof SizeCounts) { if (disabled) return; onChange({ ...counts, [k]: counts[k] + 1 }); }
  function reset() { if (disabled) return; onChange(defaultSizeCounts()); }
  return (<div className="flex items-center gap-3">
    {(["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[]).map((k) => (
      <button key={k} type="button" onClick={() => inc(k)}
        className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold
        ${counts[k] > 0 ? "bg-primary text-white" : "bg-white"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        disabled={disabled} title={k === "FT" ? "FATIA" : String(k)}>
        {k}{counts[k] > 0 && <span className="ml-1">{counts[k]}</span>}
      </button>
    ))}
    <Badge variant="secondary" onClick={reset} className={`ml-1 cursor-pointer ${disabled ? "opacity-50 pointer-events-none" : ""}`}>Zerar</Badge>
  </div>);
}
