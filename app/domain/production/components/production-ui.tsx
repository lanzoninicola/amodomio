import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  formatProductionQuantity,
  type ProductionPlanLine,
} from "../production-order-calc";

export const ORDER_STATUS_STYLE: Record<string, { label: string; className: string }> = {
  planned: { label: "Planejada", className: "bg-slate-200 text-slate-900 border-slate-300" },
  in_progress: { label: "Em produção", className: "bg-amber-400 text-amber-950 border-amber-500" },
  finished: { label: "Finalizada", className: "bg-emerald-500 text-white border-emerald-600" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-800 border-red-300" },
};

export const STEP_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
};

/** Cada preparação ganha uma cor própria para ser reconhecida de longe. */
export const STEP_COLORS = [
  { bar: "bg-sky-500", soft: "bg-sky-50 border-sky-300", text: "text-sky-700" },
  { bar: "bg-violet-500", soft: "bg-violet-50 border-violet-300", text: "text-violet-700" },
  { bar: "bg-orange-500", soft: "bg-orange-50 border-orange-300", text: "text-orange-700" },
  { bar: "bg-teal-500", soft: "bg-teal-50 border-teal-300", text: "text-teal-700" },
  { bar: "bg-pink-500", soft: "bg-pink-50 border-pink-300", text: "text-pink-700" },
  { bar: "bg-lime-600", soft: "bg-lime-50 border-lime-300", text: "text-lime-700" },
];
export const FINAL_COLOR = {
  bar: "bg-stone-700",
  soft: "bg-stone-50 border-stone-300",
  text: "text-stone-700",
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const style = ORDER_STATUS_STYLE[status] ?? ORDER_STATUS_STYLE.planned;
  return (
    <Badge className={cn("px-4 py-1.5 text-base font-semibold hover:bg-current", style.className, className)}>
      {style.label}
    </Badge>
  );
}

export function Quantity({
  quantity,
  unit,
  className,
}: {
  quantity: number;
  unit: string;
  className?: string;
}) {
  const q = formatProductionQuantity(quantity, unit);
  return (
    <span className={cn("tabular-nums font-bold", className)}>
      {q.value} <span className="font-semibold text-muted-foreground">{q.unit}</span>
    </span>
  );
}

export function IngredientList({ lines }: { lines: ProductionPlanLine[] }) {
  return (
    <ul className="grid gap-3">
      {lines.map((line) => (
        <li
          key={line.id}
          className="flex items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4"
        >
          <span className="text-xl font-medium">{line.name}</span>
          <Quantity quantity={line.quantity} unit={line.unit} className="text-3xl 2xl:text-4xl" />
        </li>
      ))}
    </ul>
  );
}
