import { Bell, Check, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { useNotificationCenter } from "../notification-center-context";
import { NotificationFeed } from "./notification-feed";

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

        <div className="mt-2 flex max-h-[70vh] flex-col overflow-hidden">
          <NotificationFeed
            items={items}
            initialized={initialized}
            onMarkAsRead={markAsRead}
            emptyTitle="Nenhuma notificação por aqui ainda."
            emptyDescription="Você verá novidades e alertas importantes aqui."
            loadingMessage="Carregando notificações..."
            className="flex-1 overflow-auto pr-2"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
