import { Badge } from "@/components/ui/badge";
import type { SizeCounts } from "../types";
import { defaultSizeCounts } from "../types";

export function SizeSelector({
  counts,
  onChange,
  disabled,
  limit,
}: {
  counts: SizeCounts;
  onChange: (next: SizeCounts) => void;
  disabled?: boolean;
  limit?: Partial<Record<keyof SizeCounts, number>>;
}) {
  function inc(k: keyof SizeCounts) {
    if (disabled) return;
    const max = limit?.[k];
    if (typeof max === "number" && counts[k] >= max) return;
    onChange({ ...counts, [k]: counts[k] + 1 });
  }

  function reset() {
    if (disabled) return;
    onChange(defaultSizeCounts());
  }

  return (
    <div className="flex items-center gap-3">
      {(["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[]).map((k) => {
        const max = limit?.[k];
        const title = max != null ? `${k} (até ${max})` : k === "FT" ? "FATIA" : String(k);

        return (
          <button
            key={k}
            type="button"
            onClick={() => inc(k)}
            className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold
        ${counts[k] > 0 ? "bg-blue-800 text-white" : "bg-white"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={disabled}
            title={title}
          >
            {k}
            {counts[k] > 0 && <span className="ml-1">{counts[k]}</span>}
          </button>
        );
      })}
      <Badge
        variant="secondary"
        onClick={reset}
        className={`ml-1 cursor-pointer ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        Zerar
      </Badge>
    </div>
  );
}
