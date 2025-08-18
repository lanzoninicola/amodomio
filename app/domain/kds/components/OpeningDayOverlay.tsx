import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function OpeningDayOverlay({ open, progress, hasError, errorMessage, onClose, }:
{ open: boolean; progress: number; hasError?: boolean; errorMessage?: string | null; onClose?: () => void; }) {
  const isDone = progress >= 100 && !hasError;
  return (<Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isDone ? (<><CheckCircle2 className="w-5 h-5" />Dia aberto!</>) : hasError ? ("Falha ao abrir o dia") : ("Abrindo o dia…")}
        </DialogTitle>
        <DialogDescription>
          {isDone ? "As comandas iniciais foram criadas." : hasError ? "Ocorreu um erro ao criar as comandas." : "Criando as comandas iniciais no banco…"}
        </DialogDescription>
      </DialogHeader>
      {!isDone && !hasError && (<div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <div className="w-full">
          <div className="w-full h-2 rounded bg-slate-200 overflow-hidden">
            <div className="h-full bg-slate-900/80 transition-[width] duration-300" style={{ width: `${Math.max(5, Math.min(100, progress))}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-600">{Math.floor(progress)}%</div>
        </div>
      </div>)}
      {hasError && (<div className="space-y-3">
        {errorMessage && (<div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMessage}</div>)}
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Fechar</Button></div>
      </div>)}
      {isDone && <div className="text-sm text-slate-600">Fechando em instantes…</div>}
    </DialogContent>
  </Dialog>);
}
