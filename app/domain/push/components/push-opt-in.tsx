import { useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { registerPushSubscription } from "../push-client";
import { Button } from "~/components/ui/button";

type Props = {
  vapidPublicKey: string | null;
};

export function PushOptIn({ vapidPublicKey }: Props) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!vapidPublicKey) return null;

  async function handleSubscribe() {
    setStatus("working");
    setError(null);
    try {
      await registerPushSubscription(vapidPublicKey);
      setStatus("done");
    } catch (err: any) {
      setError(err?.message || "Não foi possível ativar as notificações.");
      setStatus("error");
    }
  }

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
            <p className="text-xs ">Avisa quando abrirmos e para promos relâmpago.</p>
            <p className="text-xs ">Sem spam, só novidades que importam.</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[180px]">
          <Button
            className="w-full font-semibold shadow-lg "
            onClick={handleSubscribe}
            disabled={status === "working" || status === "done"}
            variant={status === "done" ? "secondary" : "default"}
          >
            {status === "done" && <Check className="mr-2 h-4 w-4" />}
            {status === "working" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === "done" ? "Ativado" : status === "working" ? "Ativando..." : "Quero receber"}
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
        </div>
      </div>
    </div>
  );
}
