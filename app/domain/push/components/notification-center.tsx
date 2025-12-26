import { Link } from "@remix-run/react";
import { Bell, Check, Clock3, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { useNotificationCenter } from "../notification-center-context";
import { NotificationEntry } from "../notification-storage";

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

function NotificationItem({ item, onRead }: { item: NotificationEntry; onRead: (id: string) => void }) {
  return (
    <div
      className="rounded-lg border border-slate-200/60 bg-white/70 px-3 py-2 shadow-sm transition hover:border-slate-300 hover:bg-white"
      role="article"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-tight">{item.title}</span>
            {!item.read && (
              <Badge variant="secondary" className="text-[10px]">
                Novo
              </Badge>
            )}
          </div>
          {item.body && <p className="text-xs text-slate-600">{item.body}</p>}
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Clock3 className="h-3 w-3" aria-hidden />
            <span>{formatDate(item.ts)}</span>
            {item.type && (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden />
                <span className="uppercase tracking-wide">{item.type}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {item.url ? (
            <Link
              to={item.url}
              prefetch="intent"
              className="text-[12px] font-semibold text-blue-700 underline"
              onClick={() => onRead(item.id)}
            >
              Abrir
            </Link>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]" onClick={() => onRead(item.id)}>
              <Check className="mr-1 h-3 w-3" />
              Marcar lida
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const { items, unreadCount, markAllAsRead, clearAll, markAsRead, initialized } = useNotificationCenter();
  const hasItems = items.length > 0;

  const indicator = useMemo(() => {
    if (!unreadCount) return null;
    return <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />;
  }, [unreadCount]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Centro de notificações">
          <Bell className="h-5 w-5" />
          {indicator}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[360px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>Feed com as últimas notificações recebidas.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={markAllAsRead} disabled={!unreadCount || !hasItems}>
            <Check className="mr-2 h-3 w-3" />
            Marcar todas como lidas
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={!hasItems}>
            <Trash2 className="mr-1 h-3 w-3" />
            Limpar
          </Button>
        </div>

        <Separator className="my-4" />

        {!initialized && <p className="text-sm text-slate-500">Carregando notificações...</p>}

        {initialized && !hasItems && <p className="text-sm text-slate-500">Nenhuma notificação por aqui ainda.</p>}

        <div className="flex max-h-[70vh] flex-col gap-2 overflow-auto pr-2">
          {items.map((item) => (
            <NotificationItem key={item.id} item={item} onRead={markAsRead} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
