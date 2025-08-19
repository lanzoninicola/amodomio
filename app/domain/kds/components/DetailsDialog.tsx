import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtElapsedHHMM, fmtHHMM } from "../utils/date";
export function DetailsDialog({ open, onOpenChange, createdAt, nowMs, status, onStatusChange, onSubmit, orderAmount, motoValue, sizeSummary, channel, }:
{ open: boolean; onOpenChange: (v: boolean) => void; createdAt?: string | Date | null; nowMs: number; status: string; onStatusChange: (value: string) => void; onSubmit: () => void; orderAmount?: number; motoValue?: number; sizeSummary?: string; channel?: string | null; }) {
  return (<Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Detalhes</DialogTitle><DialogDescription>Informações completas do registro</DialogDescription></DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-gray-500">Criado às</div><div className="font-mono text-3xl">{fmtHHMM(createdAt)}</div></div>
          <div><div className="text-gray-500">Decorrido</div><div className="font-mono text-3xl">{fmtElapsedHHMM(createdAt, nowMs)}</div></div>
        </div>
        <div className="space-y-2">
          <div className="text-gray-500">Status</div>
          <Select defaultValue={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">(0) Pendente</SelectItem>
              <SelectItem value="novoPedido">(1) Novo Pedido</SelectItem>
              <SelectItem value="emProducao">(2) Em Produção</SelectItem>
              <SelectItem value="aguardandoForno">(3) Aguardando forno</SelectItem>
              <SelectItem value="assando">(4) Assando</SelectItem>
              <SelectItem value="finalizado">(5) Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-gray-500">Pedido (R$)</div><div className="font-mono">{(orderAmount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
          <div><div className="text-gray-500">Moto (R$)</div><div className="font-mono">{(motoValue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
        </div>
        {sizeSummary && (<div><div className="text-gray-500">Tamanhos</div><div className="font-mono">{sizeSummary}</div></div>)}
        {channel && (<div><div className="text-gray-500">Canal</div><div>{channel}</div></div>)}
      </div>
      <DialogFooter className="gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button><Button onClick={onSubmit}>Salvar alterações</Button></DialogFooter>
    </DialogContent>
  </Dialog>);
}
