import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function ConfirmDeleteDialog({ open, onOpenChange, onConfirm, title = "Cancelar pedido?", description = "Esta ação remove definitivamente o registro. Não será possível desfazer.", }:
{ open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void; title?: string; description?: string; }) {
  return (<Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button><Button variant="destructive" onClick={onConfirm}>Excluir</Button></DialogFooter>
    </DialogContent>
  </Dialog>);
}
