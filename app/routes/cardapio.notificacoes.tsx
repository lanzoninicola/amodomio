import { useRouteLoaderData } from "@remix-run/react";
import { Bell, Check, Inbox, Settings, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { PushOptIn } from "~/domain/push/components/push-opt-in";
import { useNotificationCenter } from "~/domain/push/notification-center-context";
import { removePushSubscription } from "~/domain/push/push-client";
import { useToast } from "~/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { loader as cardapioLoader } from "./cardapio";

export const meta = () => {
  return [
    { title: "Notificações - A Modo Mio" },
    { name: "description", content: "Histórico e preferências de notificações A Modo Mio." },
  ];
};

export default function CardapioNotificationsRoute() {
  const cardapioData = useRouteLoaderData<typeof cardapioLoader>("routes/cardapio");
  const vapidPublicKey = cardapioData?.vapidPublicKey ?? null;
  const { toast } = useToast();
  const [removingSubscription, setRemovingSubscription] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const { items, initialized, unreadCount, markAllAsRead, clearAll, markAsRead } = useNotificationCenter();
  const hasItems = items.length > 0;

  const subtitle = useMemo(() => {
    if (!initialized) return "Carregando suas notificações…";
    if (!hasItems) return "Quando chegarem, suas notificações aparecem aqui.";
    return "Suas últimas notificações, com ação rápida.";
  }, [hasItems, initialized]);

  async function handleRemoveSubscription() {
    if (removingSubscription) return;
    setRemovingSubscription(true);
    try {
      const result = await removePushSubscription();
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Não foi possível cancelar",
          description: result.error || "Tente novamente em instantes.",
        });
        return;
      }
      setPreferencesOpen(false);
      toast({
        title: "Inscrição removida",
        description: "Você não receberá mais notificações push.",
      });
    } finally {
      setRemovingSubscription(false);
    }
  }

  return (
    <section className="pt-32 pb-16 px-4 md:pt-32 md:max-w-4xl md:mx-auto font-neue">
      <div className="mb-4">
        <PushOptIn vapidPublicKey={vapidPublicKey} forceShow />
      </div>

      <div className="flex flex-col space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Central de Notificações
          </h1>
          <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Preferências de notificações"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader className="space-y-2">
                <DialogTitle>Preferências</DialogTitle>
                <DialogDescription>Ações rápidas da sua central de notificações.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    markAllAsRead();
                    setPreferencesOpen(false);
                  }}
                  disabled={!unreadCount || !hasItems}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Marcar todas como lidas
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    clearAll();
                    setPreferencesOpen(false);
                  }}
                  disabled={!hasItems}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar todas
                </Button>
                <Separator />
                <Button
                  variant="destructive"
                  onClick={handleRemoveSubscription}
                  disabled={removingSubscription}
                >
                  {removingSubscription ? "Removendo..." : "Parar de receber notificações"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Separator className="my-4" />

      {!initialized && <p className="text-sm text-muted-foreground">Sincronizando com seu navegador…</p>}

      {initialized && !hasItems && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p>Ainda não há notificações.</p>
        </div>
      )}

      {hasItems && (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-slate-200/60 bg-white/80 p-3 shadow-sm"
              role="article"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold leading-tight">{item.title}</h2>
                    {!item.read && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        Novo
                      </span>
                    )}
                  </div>
                  {item.body && <p className="text-xs text-slate-600">{item.body}</p>}
                  <p className="text-[11px] text-slate-500">{new Date(item.ts).toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {item.url && (
                    <Button asChild variant="link" size="sm" className="h-7 px-0 text-xs">
                      <a href={item.url} onClick={() => markAsRead(item.id)}>
                        Abrir
                      </a>
                    </Button>
                  )}
                  {!item.read && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => markAsRead(item.id)}>
                      Marcar lida
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
