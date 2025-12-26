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

  const displayTime = useMemo(() => {
    try {
      return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, []);

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
    <div className="flex justify-center px-2 bg-white">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-gradient-to-br text-slate-900 shadow-md ring-1 ring-white/50">
        <div className="flex flex-col divide-y divide-white/40">
          <div className="flex items-start gap-3 px-5 py-5 sm:px-6 sm:py-6">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-200/90 shadow-md ring-1 ring-amber-100">
                {status === "done" ? <Check className="h-6 w-6 text-amber-900" /> : <Bell className="h-6 w-6 text-amber-900" />}
              </div>
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-200 text-[11px] font-bold shadow ring-2 ring-white">
                6
              </span>
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-semibold leading-tight">Receber notificações</p>
                {displayTime && <span className="text-sm font-semibold text-slate-700/80">{displayTime}</span>}
              </div>

              <p className="text-xs leading-snug text-slate-800/90">
                Aproveite alertas rápidos sobre novidades e ofertas relâmpago. Nada de spam, só o essencial.
              </p>
            </div>
          </div>



          <div className="grid grid-cols-2 gap-x-4">
            <Button
              variant="ghost"
              className="font-neue h-12 text-slate-600 transition hover:bg-slate-900/10"
              onClick={handleDismiss}
              type="button"
            >
              {isBlocked ? "Fechar" : "Agora não"}
            </Button>
            <Button
              className="h-12 rounded-lg"
              onClick={handleSubscribe}
              disabled={status === "working" || status === "done" || !!supportError}
              variant="secondary"
            >
              {status === "done" && <Check className="mr-2 h-4 w-4" />}
              {status === "working" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {status === "done" ? "Notificações ativas" : status === "working" ? "Ativando..." : "Ativar notificações"}
            </Button>


          </div>
        </div>

        {(error || supportError || isBlocked || status === "done") && (
          <div className="space-y-1 px-6 pb-5 text-[12px] leading-snug text-slate-800/90">
            {supportError && <p className="text-red-700">{supportError}</p>}
            {isBlocked && (
              <p className="text-amber-800">
                Permissão negada no navegador. Libere em &ldquo;Configurações do site &gt; Notificações&rdquo; para ativar.
              </p>
            )}
            {error && (
              <p className="text-red-700" role="status">
                {error}
              </p>
            )}
            {status === "done" && !error && (
              <p className="text-emerald-900" role="status">
                Tudo certo! Você receberá notificações.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
