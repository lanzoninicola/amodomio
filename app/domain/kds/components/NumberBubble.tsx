import { useMemo } from "react";
import { STATUS_COLORS } from "../constants";
export function NumberBubble({ commandNumber, isVendaLivre, displayNumber, status, savingState, onClick, showBadge = true }:
{ commandNumber: number | null; isVendaLivre: boolean; displayNumber: number; status?: string | null; savingState?: "idle" | "saving" | "ok" | "error"; onClick?: () => void; showBadge?: boolean; }) {
  const classes = useMemo(() => {
    if (savingState === "saving") return "bg-gray-200";
    if (savingState === "ok") return "bg-green-500 text-white";
    if (savingState === "error") return "bg-red-500 text-white";
    return isVendaLivre ? "bg-white text-gray-700 border-dashed" : STATUS_COLORS[status || "novoPedido"] || "bg-gray-200 text-gray-800";
  }, [savingState, isVendaLivre, status]);
  return (<div className="flex items-center justify-center gap-2">
    <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold cursor-pointer ${classes}`} onClick={onClick}
      title={commandNumber ? `Comanda ${commandNumber}` : `Venda livre (posição ${displayNumber})`}>{commandNumber ?? displayNumber}</div>
    {showBadge && (isVendaLivre || commandNumber == null) && (<span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 border">VL</span>)}
  </div>);
}
