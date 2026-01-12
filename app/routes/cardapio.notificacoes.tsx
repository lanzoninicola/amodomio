import { useRouteLoaderData } from "@remix-run/react";
import { AlertTriangle, Bell, Check, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { useNotificationCenter } from "~/domain/push/notification-center-context";
import { NotificationFeed, NotificationCallToActionItem } from "~/domain/push/components/notification-feed";
import { getExistingPushSubscription, getPushSupport, registerPushSubscription, removePushSubscription } from "~/domain/push/push-client";
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
  const notificationsEnabled = cardapioData?.notificationsEnabled ?? true;

  if (!notificationsEnabled) {
    return (
      <section className="pt-32 pb-16 px-4 md:pt-32 md:max-w-4xl md:mx-auto font-neue">
        <div className="flex flex-col space-y-2">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações desativadas
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta central está desligada no painel do cardápio.
          </p>
        </div>
      </section>
    );
  }

  return <NotificationsEnabled vapidPublicKey={vapidPublicKey} />;
}

function NotificationsEnabled({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const { toast } = useToast();
  const [removingSubscription, setRemovingSubscription] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [subscriptionState, setSubscriptionState] = useState<
    "checking" | "active" | "inactive" | "blocked" | "unsupported" | "error"
  >("checking");
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
  const [subscriptionWorking, setSubscriptionWorking] = useState(false);
  const [installState, setInstallState] = useState<"hidden" | "android" | "ios" | "installed" | "unsupported">("hidden");
  const [beforeInstallEvent, setBeforeInstallEvent] = useState<any | null>(null);
  const [installWorking, setInstallWorking] = useState(false);

  const { items, initialized, unreadCount, markAllAsRead, clearAll, markAsRead } = useNotificationCenter();
  const hasItems = items.length > 0;

  const subtitle = useMemo(() => {
    if (!initialized) return "Carregando suas notificações…";
    if (!hasItems) return "Quando chegarem, suas notificações aparecem aqui.";
    return "Suas últimas notificações, com ação rápida.";
  }, [hasItems, initialized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;

    if (isStandalone) {
      setInstallState("installed");
      return;
    }

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
    if (isIos) {
      setInstallState("ios");
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setBeforeInstallEvent(event);
      setInstallState("android");
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const refreshSubscriptionStatus = useCallback(async () => {
    setSubscriptionState("checking");
    setSubscriptionMessage(null);
    try {
      const support = getPushSupport();
      if (!support.supported) {
        setSubscriptionState("unsupported");
        setSubscriptionMessage(support.reason);
        return;
      }

      if (Notification.permission === "denied") {
        setSubscriptionState("blocked");
        setSubscriptionMessage(
          "Permissão negada no navegador. Libere em Ajustes > Configurações do site > Notificações para ativar."
        );
        return;
      }

      const sub = await getExistingPushSubscription();
      if (sub) {
        setSubscriptionState("active");
        setSubscriptionMessage("Inscrição ativa.");
      } else {
        setSubscriptionState("inactive");
        setSubscriptionMessage("Nenhuma inscrição encontrada.");
      }
    } catch (err) {
      setSubscriptionState("error");
      setSubscriptionMessage("Não foi possível verificar a inscrição agora.");
    }
  }, []);

  useEffect(() => {
    void refreshSubscriptionStatus();
  }, [refreshSubscriptionStatus]);

  useEffect(() => {
    if (!preferencesOpen) return;
    let canceled = false;
    void refreshSubscriptionStatus().catch(() => {
      if (!canceled) {
        setSubscriptionState("error");
        setSubscriptionMessage("Não foi possível verificar a inscrição agora.");
      }
    });
    return () => {
      canceled = true;
    };
  }, [preferencesOpen, refreshSubscriptionStatus]);

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

  async function handleResubscribe() {
    if (subscriptionWorking || !vapidPublicKey) return;
    setSubscriptionWorking(true);
    setSubscriptionMessage(null);
    try {
      const support = getPushSupport();
      if (!support.supported) {
        setSubscriptionState("unsupported");
        setSubscriptionMessage(support.reason);
        return;
      }
      if (Notification.permission === "denied") {
        setSubscriptionState("blocked");
        setSubscriptionMessage(
          "Permissão negada no navegador. Libere em Ajustes > Configurações do site > Notificações para ativar."
        );
        return;
      }
      await registerPushSubscription(vapidPublicKey);
      setSubscriptionState("active");
      setSubscriptionMessage("Inscrição reativada com sucesso.");
    } catch (err: any) {
      setSubscriptionState("error");
      setSubscriptionMessage(
        err?.message || "Não foi possível reativar agora. Confira a permissão e tente novamente."
      );
    } finally {
      setSubscriptionWorking(false);
    }
  }

  async function handleInstall() {
    if (installWorking) return;
    setInstallWorking(true);
    try {
      if (installState === "android" && beforeInstallEvent?.prompt) {
        await beforeInstallEvent.prompt();
        const choice = await beforeInstallEvent.userChoice?.catch(() => null);
        if (choice?.outcome === "accepted") {
          setInstallState("installed");
        }
      } else {
        // iOS: apenas instrução, não há prompt
      }
    } finally {
      setInstallWorking(false);
    }
  }

  const ctaItems = useMemo<NotificationCallToActionItem[]>(() => {
    const list: NotificationCallToActionItem[] = [];

    list.push({
      id: "cta-push",
      title: "Ativar notificações",
      description:
        subscriptionMessage ||
        (subscriptionState === "active"
          ? "Inscrição ativa. Gerencie suas preferências."
          : "Ative para receber alertas do cardápio."),
      severity: "important",
      icon: <Bell className="h-5 w-5" />,
      primaryLabel: subscriptionState === "active"
        ? "Ativo"
        : subscriptionState === "checking"
          ? "Verificando"
          : "Ativar agora",
      onPrimary: subscriptionState === "active" ? () => setPreferencesOpen(true) : handleResubscribe,
      primaryDisabled: subscriptionWorking || (!vapidPublicKey && subscriptionState !== "active"),
    });

    if (installState === "android") {
      list.push({
        id: "cta-install",
        title: "Instalar aplicativo",
        description: "Instale o atalho para abrir mais rápido e receber notificações.",
        severity: "important",
        icon: <Bell className="h-5 w-5" />,
        primaryLabel: "Instalar app",
        onPrimary: handleInstall,
        primaryDisabled: installWorking,
      });
    }

    return list;
  }, [
    subscriptionMessage,
    subscriptionState,
    subscriptionWorking,
    vapidPublicKey,
    handleInstall,
  ]);

  const effectiveItems = useMemo(() => {
    const base = [...items];
    if (installState === "ios") {
      base.unshift({
        id: "install-ios-tip",
        title: "Instalar aplicativo",
        body: "No Safari, toque em Compartilhar e depois em \"Adicionar à Tela de Início\" para receber notificações.",
        url: undefined,
        ts: Date.now(),
        read: false,
        source: "local",
      });
    }
    return base;
  }, [items, installState]);

  return (
    <section className="pt-32 pb-16 px-4 md:pt-32 md:max-w-4xl md:mx-auto font-neue">
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
                <DialogTitle className="font-neue text-left">Preferências</DialogTitle>

              </DialogHeader>

              <div className="flex flex-col gap-2">
                <section className="w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-neue ">Status das notificações</p>
                    <Badge className="uppercase font-semibold " variant={
                      subscriptionState === "active"
                        ? "default"
                        : subscriptionState === "checking"
                          ? "outline"
                          : "secondary"
                    }>
                      {subscriptionState === "checking"
                        ? "Verificando"
                        : subscriptionState === "active"
                          ? "Ativo"
                          : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    {subscriptionMessage ||
                      (subscriptionState === "checking"
                        ? "Verificando..."
                        : subscriptionState === "active"
                          ? "Inscrição ativa."
                          : "Inscrição não encontrada.")}
                  </p>

                  {(subscriptionState === "inactive" ||
                    subscriptionState === "error" ||
                    subscriptionState === "blocked" ||
                    subscriptionState === "unsupported") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleResubscribe}
                        disabled={subscriptionWorking || !vapidPublicKey}
                        className="font-neue w-full"
                      >
                        {subscriptionWorking ? "Ativando..." : "Ativar novamente"}
                      </Button>
                    )}
                </section>

                <Separator className="my-4" />

                <section className="w-full space-y-2">

                  <p className="font-neue ">Ações rápidas com as notificações</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      markAllAsRead();
                      setPreferencesOpen(false);
                    }}
                    disabled={!unreadCount || !hasItems}
                    className="font-neue w-full"
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
                    className="font-neue w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpar todas
                  </Button>
                </section>

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
        items={effectiveItems}
        initialized={initialized}
        onMarkAsRead={markAsRead}
        ctaItems={ctaItems}
        loadingMessage="Sincronizando com seu navegador…"
        emptyTitle="Ainda não há notificações."
        emptyDescription="Quando chegarem, suas notificações aparecem aqui."
      />
    </section>
  );
}
