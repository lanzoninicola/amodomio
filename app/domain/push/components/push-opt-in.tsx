import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, Check, Loader2, Star } from "lucide-react";
import { PushSupport, getExistingPushSubscription, getPushSupport, registerPushSubscription } from "../push-client";
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
  const [shouldShow, setShouldShow] = useState(false);
  const [support, setSupport] = useState<PushSupport>({ supported: true });

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

    const supportResult = getPushSupport();
    setSupport(supportResult);
    if (!supportResult.supported) {
      setPermission(null);
    } else {
      setPermission(Notification.permission);
    }

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

  function handleFallbackOptIn() {
    setError(null);
    setStatus("done");
    if (typeof window !== "undefined") window.localStorage.setItem(OPTED_IN_KEY, "fallback");
    setShouldShow(false);
  }

  async function handleSubscribe() {
    if (isBlocked) {
      setError("Você bloqueou as notificações no navegador. Reative nas configurações do site para continuar.");
      return;
    }
    if (status === "working" || status === "done") return;
    setStatus("working");
    setError(null);
    if (!support.supported || !vapidPublicKey) {
      handleFallbackOptIn();
      return;
    }
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


  const actionLabel =
    status === "done" ? "Notificações ativas" : status === "working" ? "Ativando..." : "Ativar";

  if (!shouldShow) return null;

  return (
    <div className="flex justify-center bg-slate-900/95">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-gradient-to-br text-slate-900 shadow-md ">
        <div className="flex flex-col divide-y divide-white/40">
          <div className="flex items-start gap-3 p-4 sm:px-6 sm:py-6">

            <div className="flex items-center justify-between gap-x-5">
              <div className="flex items-center gap-x-2">
                <PushOptInIcon />
                <p className="font-neue text-white uppercase  leading-tight tracking-wide">Receber notificações</p>
              </div>
              <div className="flex flex-col gap-y-1">
                <Button
                  variant="ghost"
                  className="font-neue text-xs tracking-wide h-8 text-slate-100 transition hover:bg-slate-900/10 uppercase font-normal border border-slate-100 rounded-none "
                  onClick={handleDismiss}
                  type="button"
                >
                  {isBlocked ? "Fechar" : "Agora não"}
                </Button>
                <Button
                  className="h-8 text-sm rounded-none uppercase tracking-wide font-semibold "
                  onClick={handleSubscribe}
                  disabled={status === "working" || status === "done"}
                  variant="secondary"
                >
                  {status === "done" && <Check className="mr-2 h-4 w-4" />}
                  {status === "working" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <span className="flex items-center gap-x-1">

                    {actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>


              </div>
            </div>
          </div>
        </div>

        {(error || isBlocked || status === "done") && (
          <div className="space-y-1 px-6 pb-5 text-[12px] leading-snug text-slate-800/90">
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
                Tudo certo! Preferências salvas.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function PushOptInIcon() {
  return (
    <Bell className="h-5 w-5 text-white" />
  )
}