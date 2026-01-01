import { useRouteLoaderData } from "@remix-run/react";
import { Bell, Check, Settings, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { PushOptIn } from "~/domain/push/components/push-opt-in";
import { useNotificationCenter } from "~/domain/push/notification-center-context";
import { NotificationFeed } from "~/domain/push/components/notification-feed";
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
                <DialogTitle className="font-neue">Preferências</DialogTitle>
                <DialogDescription className="font-neue">Ações rápidas da sua central de notificações.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    markAllAsRead();
                    setPreferencesOpen(false);
                  }}
                  disabled={!unreadCount || !hasItems}
                  className="font-neue"
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
                  className="font-neue"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar todas
                </Button>
                <Separator className="mt-8 mb-2" />
                <Button
                  variant="destructive"
                  onClick={handleRemoveSubscription}
                  disabled={removingSubscription}
                  className="font-neue tracking-wide"
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

      <NotificationFeed
        items={items}
        initialized={initialized}
        onMarkAsRead={markAsRead}
        loadingMessage="Sincronizando com seu navegador…"
        emptyTitle="Ainda não há notificações."
        emptyDescription="Quando chegarem, suas notificações aparecem aqui."
      />
    </section>
  );
}
