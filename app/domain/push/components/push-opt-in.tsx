import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { getExistingPushSubscription, getPushSupport, registerPushSubscription } from "../push-client";
import { Button } from "~/components/ui/button";

type Props = {
  vapidPublicKey: string | null;
  forceShow?: boolean;
};

const DISMISS_KEY = "amodomio.pushoptin.dismissedAt";
const OPTED_IN_KEY = "amodomio.pushoptin.optedin";
const REASK_DELAY_MS = 1000 * 60 * 60 * 24; // 24h

export function PushOptIn({ vapidPublicKey, forceShow = false }: Props) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [shouldShow, setShouldShow] = useState(false);

  const isBlocked = permission === "denied";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissedAtRaw = window.localStorage.getItem(DISMISS_KEY);
    const optedIn = window.localStorage.getItem(OPTED_IN_KEY);
    const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : null;
    const canShow =
      forceShow ||
      (!optedIn && (!dismissedAt || Number.isNaN(dismissedAt) || Date.now() - dismissedAt > REASK_DELAY_MS));
    setShouldShow(!!canShow);

    const support = getPushSupport();
    if (!support.supported) {
      setSupportError(support.reason);
      setStatus("error");
      return;
    }
    setSupportError(null);
    setPermission(Notification.permission);

    getExistingPushSubscription()
      .then((sub) => {
        if (sub) {
          setStatus("done");
          window.localStorage.setItem(OPTED_IN_KEY, "1");
          setShouldShow(false);
        }
      })
      .catch(() => {
        /* silencioso */
      });
  }, []);

  const buttonLabel = useMemo(() => {
    if (status === "done") return "Ativado";
    if (status === "working") return "Ativando...";
    if (isBlocked) return "Permissão negada";
    return "Quero receber";
  }, [isBlocked, status]);

  async function handleSubscribe() {
    if (isBlocked) {
      setError("Você bloqueou as notificações no navegador. Reative nas configurações do site para continuar.");
      return;
    }
    if (status === "working" || status === "done") return;
    setStatus("working");
    setError(null);
    try {
      await registerPushSubscription(vapidPublicKey);
      setStatus("done");
      if (typeof window !== "undefined") window.localStorage.setItem(OPTED_IN_KEY, "1");
      setShouldShow(false);
    } catch (err: any) {
      const friendlyMessage =
        err?.name === "InvalidStateError"
          ? "As notificações parecem bloqueadas neste navegador. Verifique as permissões do site."
          : err?.message || "Não foi possível ativar as notificações agora. Tente de novo em instantes.";
      console.error("[push] subscribe failed", err);
      setError(friendlyMessage);
      setStatus("error");
    }
  }

  function handleDismiss() {
    setStatus("idle");
    setError(null);
    setShouldShow(false);
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  if (!vapidPublicKey || !shouldShow) return null;

  return (
    <div className="relative bg-slate-50 px-4">

      <div className="flex flex-col gap-3 pr-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
            {status === "done" ? <Check className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">

              <p className="text-sm font-semibold uppercase">Receber notificações</p>

            </div>
            <p className="text-xs ">Avisa quando abrirmos e para promos relâmpago. Sem spam.</p>
            {supportError && <p className="text-xs text-red-500">{supportError}</p>}
            {isBlocked && (
              <p className="text-xs text-amber-600">
                Permissão negada no navegador. Libere em &ldquo;Configurações do site &gt; Notificações&rdquo; para ativar.
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[180px]">
          <Button
            className="w-full font-semibold shadow-lg "
            onClick={handleSubscribe}
            disabled={status === "working" || status === "done" || !!supportError}
            variant={status === "done" ? "secondary" : "default"}
          >
            {status === "done" && <Check className="mr-2 h-4 w-4" />}
            {status === "working" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {buttonLabel}
          </Button>

          {error && (
            <p className="text-[11px] text-red-200" role="status">
              {error}
            </p>
          )}
          {status === "done" && (
            <p className="text-[11px] text-emerald-100" role="status">
              Tudo certo! Você receberá notificações.
            </p>
          )}
          <Button variant="link" className="justify-start px-0 text-xs" onClick={handleDismiss}>
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
