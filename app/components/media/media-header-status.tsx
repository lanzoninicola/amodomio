import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, HardDrive, RefreshCw, XCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

type MediaHealthInfo = {
  endpoint: string | null;
  httpStatus: number | null;
  baseUrl: string | null;
  details: string | null;
  checkedAt: number | null;
};

export function useMediaHeaderStatus(enabled: boolean) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<MediaHealthInfo | null>(null);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setChecking(true);
    try {
      const response = await fetch("/api/media/health", {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = response.ok ? await response.json() : null;
      if (!controller.signal.aborted) {
        setOnline(data?.online === true);
        setInfo({
          endpoint: data?.endpoint ?? null,
          httpStatus: data?.httpStatus ?? response.status,
          baseUrl: data?.baseUrl ?? null,
          details: data?.details ?? null,
          checkedAt: data?.checkedAt ?? Date.now(),
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        setOnline(false);
        setInfo({
          endpoint: null,
          httpStatus: null,
          baseUrl: null,
          details: "Falha ao consultar /api/media/health",
          checkedAt: Date.now(),
        });
      }
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
  return { online, checking, info, refresh };
}

type Status = ReturnType<typeof useMediaHeaderStatus>;
export function MediaHeaderStatus({
  status,
  compact = false,
}: {
  status: Status;
  compact?: boolean;
}) {
  const label =
    status.online === true
      ? "Servidor de mídia online"
      : status.online === false
      ? "Servidor de mídia offline"
      : status.checking
      ? "Servidor de mídia verificando"
      : "Servidor de mídia não verificado";
  const info = status.info;
  return (
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
      aria-label={`${label}. Abrir detalhes`}
      className={cn(
        "flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-xs",
        compact && "h-full min-h-8 w-full min-w-0 px-2 text-xs",
        status.online === true
          ? "text-emerald-700 hover:text-emerald-700"
          : status.online === false
          ? "text-red-700 hover:text-red-700"
          : "text-slate-500 hover:text-slate-500"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          status.checking && "animate-pulse",
          status.online === true
            ? "bg-emerald-500"
            : status.online === false
            ? "bg-red-500"
            : "bg-slate-400"
        )}
      />
      {compact ? (
        <span className="truncate">{label}</span>
      ) : (
        <HardDrive size={18} aria-hidden="true" />
      )}
    </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <HardDrive size={15} />
          Servidor de mídia
        </DropdownMenuLabel>
        <div
          aria-live="polite"
          className={cn(
            "mx-2 mb-2 flex items-start gap-2 rounded-md border px-2 py-2 text-xs",
            status.checking
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : status.online === true
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : status.online === false
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-slate-200 bg-slate-50 text-slate-700"
          )}
        >
          {status.checking ? (
            <RefreshCw size={14} className="mt-0.5 shrink-0 animate-spin" />
          ) : status.online === true ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : status.online === false ? (
            <XCircle size={14} className="mt-0.5 shrink-0" />
          ) : null}
          <span>
            {status.checking
              ? "Verificando o servidor de mídia…"
              : status.online === true
              ? "Online. Uploads de imagem e vídeo estão disponíveis."
              : status.online === false
              ? "Offline. Não é possível enviar arquivos agora."
              : "Ainda não verificado."}
          </span>
        </div>
        {info ? (
          <dl className="space-y-1 px-2 pb-2 text-xs">
            {info.baseUrl ? (
              <div>
                <dt className="text-muted-foreground">URL</dt>
                <dd className="break-all">{info.baseUrl}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Endpoint</dt>
              <dd>{info.endpoint ?? "sem resposta"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">HTTP</dt>
              <dd>{info.httpStatus ?? "-"}</dd>
            </div>
            {info.checkedAt ? (
              <div>
                <dt className="text-muted-foreground">Verificado às</dt>
                <dd>{new Date(info.checkedAt).toLocaleTimeString("pt-BR")}</dd>
              </div>
            ) : null}
            {status.online !== true && info.details ? (
              <div>
                <dt className="text-muted-foreground">Detalhes</dt>
                <dd className="break-all">{info.details}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={status.checking}
          onSelect={(event) => {
            event.preventDefault();
            void status.refresh();
          }}
        >
          <RefreshCw
            size={14}
            className={cn("mr-2", status.checking && "animate-spin")}
          />
          {status.checking ? "Verificando…" : "Verificar novamente"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
