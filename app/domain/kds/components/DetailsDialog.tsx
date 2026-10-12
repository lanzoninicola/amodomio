import { normalizeKdsChannel } from "../constants";
import { readStoredOrderItems } from "../order-items";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtElapsedHHMM, fmtHHMM } from "../utils/date";
export function DetailsDialog({
  open,
  onOpenChange,
  createdAt,
  nowMs,
  status,
  onStatusChange,
  onSubmit,
  orderAmount,
  motoValue,
  sizeSummary,
  channel,
  customerName,
  customerPhone,
  orderItems,
  onCustomerNameChange,
  onCustomerPhoneChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  createdAt?: string | Date | null;
  nowMs: number;
  status: string;
  onStatusChange: (value: string) => void;
  onSubmit: () => void;
  orderAmount?: number;
  motoValue?: number;
  sizeSummary?: string;
  channel?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderItems?: unknown;
  onCustomerNameChange?: (value: string) => void;
  onCustomerPhoneChange?: (value: string) => void;
}) {
  const items = readStoredOrderItems(orderItems);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes</DialogTitle>
          <DialogDescription>
            Informações completas do registro
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-gray-500">Criado às</div>
              <div className="font-mono text-3xl">{fmtHHMM(createdAt)}</div>
            </div>
            <div>
              <div className="text-gray-500">Decorrido</div>
              <div className="font-mono text-3xl">
                {fmtElapsedHHMM(createdAt, nowMs)}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-gray-500">Status</div>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className="w-full h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">(0) Pendente</SelectItem>
                <SelectItem value="novoPedido">(1) Novo Pedido</SelectItem>
                <SelectItem value="emProducao">(2) Em Produção</SelectItem>
                <SelectItem value="aguardandoForno">
                  (3) Aguardando forno
                </SelectItem>
                <SelectItem value="assando">(4) Assando</SelectItem>
                <SelectItem value="finalizado">(5) Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-gray-500">Nome do cliente</div>
              <Input
                value={customerName ?? ""}
                onChange={(e) => onCustomerNameChange?.(e.target.value)}
                placeholder="Opcional"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <div className="text-gray-500">Telefone do cliente</div>
              <Input
                value={customerPhone ?? ""}
                onChange={(e) => onCustomerPhoneChange?.(e.target.value)}
                placeholder="Opcional"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-gray-500">Pedido (R$)</div>
              <div className="font-mono">
                {(orderAmount ?? 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Moto (R$)</div>
              <div className="font-mono">
                {(motoValue ?? 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          {sizeSummary && (
            <div>
              <div className="text-gray-500">Tamanhos</div>
              <div className="font-mono">{sizeSummary}</div>
            </div>
          )}
          {channel && (
            <div>
              <div className="text-gray-500">Canal</div>
              <div>{normalizeKdsChannel(channel)}</div>
            </div>
          )}
          {items.length > 0 ? (
            <div className="space-y-3">
              <div className="font-medium">Itens do pedido</div>
              {items.map((item, index) => (
                <div key={index} className="rounded border p-3 space-y-1">
                  <div className="font-medium">
                    {item.quantity}× {item.name}
                    {item.size ? ` · ${item.size}` : ""}
                  </div>
                  {item.flavors.length > 0 && (
                    <div>
                      <span className="text-gray-500">Sabores escolhidos</span>
                      <ul className="list-disc pl-5">
                        {item.flavors.map((flavor, flavorIndex) => (
                          <li key={flavorIndex}>{flavor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.notes.length > 0 && (
                    <div className="text-gray-500">
                      {item.notes.join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Este pedido não tem itens e sabores registrados.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={onSubmit}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
