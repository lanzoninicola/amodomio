import { Link } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, RefreshCw, QrCode, ExternalLink } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { ZapiReconnectionControls } from "./reconnection-controls";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";

export function useWhatsappHeaderStatus(enabled: boolean) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setChecking(true);
    try {
      const response = await fetch("/api/zapi/connection", {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = response.ok ? await response.json() : null;
      if (!controller.signal.aborted)
        setConnected(
          typeof data?.connected === "boolean" ? data.connected : null
        );
    } catch {
      if (!controller.signal.aborted) setConnected(null);
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setChecking(false);
    }
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onFocus = () => void refresh();
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60_000);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      pending.current?.abort();
      pending.current = null;
    };
  }, [enabled, refresh]);
  return { connected, checking, refresh, setConnected };
}

type Status = ReturnType<typeof useWhatsappHeaderStatus>;
export function WhatsappHeaderStatus({
  status,
  canManage,
  compact = false,
}: {
  status: Status;
  canManage: boolean;
  compact?: boolean;
}) {
  const [dialog, setDialog] = useState<"reconnect" | "qr-code" | null>(null);
  const label =
    status.connected === true
      ? "WhatsApp conectado"
      : status.connected === false
      ? "WhatsApp desconectado"
      : status.checking
      ? "WhatsApp verificando"
      : "WhatsApp não verificado";
  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) void status.refresh();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={label}
            aria-label={`${label}. Abrir menu rápido do WhatsApp`}
            className={cn(
              "flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-xs",
              compact && "h-full min-h-8 w-full min-w-0 px-2 text-xs",
              status.connected === true
                ? "text-emerald-700 hover:text-emerald-700"
                : status.connected === false
                ? "text-red-700 hover:text-red-700"
                : "text-slate-500 hover:text-slate-500"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                status.connected === true
                  ? "bg-emerald-500"
                  : status.connected === false
                  ? "bg-red-500"
                  : "bg-slate-400"
              )}
            />
            {compact ? (
              <span className="truncate">{label}</span>
            ) : (
              <span aria-hidden="true">
                <WhatsAppIcon color="currentColor" width={20} height={20} />
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <MessageCircle size={15} />
            WhatsApp
          </DropdownMenuLabel>
          <p
            className="px-2 pb-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {label}
          </p>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={status.checking}
            onSelect={() => void status.refresh()}
          >
            <RefreshCw size={14} className="mr-2" />
            Verificar conexão
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog("reconnect")}>
                <RefreshCw size={14} className="mr-2" />
                Tentar reconectar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("qr-code")}>
                <QrCode size={14} className="mr-2" />
                Mostrar QR Code
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/admin/zapi/envios">
              <ExternalLink size={14} className="mr-2" />
              Envios e conexão
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            void status.refresh();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conexão do WhatsApp</DialogTitle>
            <DialogDescription>
              Verifique a conexão ou vincule novamente o WhatsApp pelo celular.
            </DialogDescription>
          </DialogHeader>
          {dialog ? (
            <ZapiReconnectionControls
              key={dialog}
              initialIntent={dialog}
              onConnectionChange={status.setConnected}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
