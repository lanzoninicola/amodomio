import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type InstallMode = "android" | "ios";
type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "amodomio.pwa.prompt.dismissedAt";
const REASK_DELAY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as any;
  return window.matchMedia("(display-mode: standalone)").matches || !!nav.standalone;
}

function isIos() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;

    const dismissedAtRaw = window.localStorage.getItem(DISMISS_KEY);
    const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : null;
    const canShow = !dismissedAt || Number.isNaN(dismissedAt) || Date.now() - dismissedAt > REASK_DELAY_MS;
    if (!canShow) return;

    if (isIos()) {
      setMode("ios");
      setShow(true);
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as PromptEvent);
      setMode("android");
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const installedHandler = () => {
      window.localStorage.removeItem(DISMISS_KEY);
      setShow(false);
    };
    window.addEventListener("appinstalled", installedHandler);
    return () => window.removeEventListener("appinstalled", installedHandler);
  }, []);

  const instructions = useMemo(() => {
    if (mode !== "ios") return null;
    return [
      "Toque no botão Compartilhar na barra inferior",
      "Escolha “Adicionar à Tela de Início”",
      "Confirme com “Adicionar”",
    ];
  }, [mode]);

  function handleDismiss() {
    setShow(false);
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  async function handleInstall() {
    if (!promptEvent) {
      handleDismiss();
      return;
    }
    setWorking(true);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice?.catch(() => undefined);
      setShow(false);
    } finally {
      setWorking(false);
      if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
  }

  if (!show || mode === null) return null;

  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4", className)}>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Instale o app A Modo Mio</p>
            <p className="text-xs text-slate-700">
              Acesso rápido ao cardápio, notificações e atalho direto da sua tela inicial.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-500 transition hover:text-slate-800"
            aria-label="Fechar aviso de instalação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "ios" && instructions && (
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2">
            {instructions.map((step, idx) => (
              <p key={step} className="text-xs text-slate-800">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  {idx + 1}
                </span>
                {step}
              </p>
            ))}
          </div>
        )}

        {mode === "android" && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-800">
            <ArrowRight className="h-4 w-4 text-slate-500" />
            Toque em instalar para adicionar o atalho à sua tela inicial.
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-slate-600">
            Agora não
          </Button>
          {mode === "android" ? (
            <Button size="sm" onClick={handleInstall} disabled={working} className="gap-2">
              <Download className="h-4 w-4" />
              {working ? "Instalando..." : "Instalar app"}
            </Button>
          ) : (
            <Button size="sm" onClick={handleDismiss} className="gap-2">
              Entendi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
