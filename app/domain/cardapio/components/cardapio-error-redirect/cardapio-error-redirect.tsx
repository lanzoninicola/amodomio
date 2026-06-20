import { AlertTriangle } from "lucide-react";
import { useLocation } from "@remix-run/react";
import { useEffect, useState } from "react";
import Logo from "~/components/primitives/logo/logo";

type CardapioErrorRedirectProps = {
  redirectHref: string;
  redirectDelaySeconds?: number;
  autoRedirectEnabled?: boolean;
};

export default function CardapioErrorRedirect({
  redirectHref,
  redirectDelaySeconds = 3,
  autoRedirectEnabled = true,
}: CardapioErrorRedirectProps) {
  const location = useLocation();
  const debugMode =
    new URLSearchParams(location.search).get("debugCardapio") === "1";
  const [redirectCancelled, setRedirectCancelled] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(redirectDelaySeconds);
  const shouldAutoRedirect =
    autoRedirectEnabled && !debugMode && !redirectCancelled;
  const retryHref = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (typeof window === "undefined" || !shouldAutoRedirect) return;

    setSecondsLeft(redirectDelaySeconds);

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => (current > 1 ? current - 1 : 1));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      window.location.replace(redirectHref);
    }, redirectDelaySeconds * 1000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [redirectDelaySeconds, redirectHref, shouldAutoRedirect]);

  return (
    <section className="min-h-screen flex flex-col px-6 py-6 md:py-8">
      <div className="flex justify-center pt-2 md:pt-4">
        <Logo circle={true} className="w-20 md:w-24" tagline={false} />
      </div>

      <div className="flex-1 flex items-center justify-center pb-20 md:pb-0">
        <div className="max-w-md text-center font-neue">
          <div className="flex flex-col items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <p className="mt-1 text-lg md:text-xl font-semibold leading-tight text-amber-600">
              Ocorreu um erro.
            </p>
          </div>
          <div className="mt-5 flex flex-col items-center justify-center">
            <p className="text-lg md:text-xl font-semibold leading-tight text-black">
              {shouldAutoRedirect
                ? "Estamos redirecionando você para finalizar seu pedido."
                : "O redirecionamento automático está pausado."}
            </p>
          </div>
          {shouldAutoRedirect ? (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">
                Redirecionamento automático
              </p>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-300/70">
                <p className="text-3xl font-bold leading-none text-amber-700">
                  {secondsLeft}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRedirectCancelled(true)}
                className="text-sm font-semibold text-slate-700 underline underline-offset-4"
              >
                Pausar para diagnosticar
              </button>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950">
              {!autoRedirectEnabled ? (
                <p>
                  O redirecionamento está desabilitado nas configurações do
                  cardápio.
                </p>
              ) : debugMode ? (
                <p>
                  Modo de diagnóstico ativo por{" "}
                  <code className="font-semibold">debugCardapio=1</code>.
                </p>
              ) : (
                <p>Redirecionamento pausado nesta tela.</p>
              )}
              <p className="mt-1 text-xs text-amber-800">
                O erro continua registrado no console e nos logs da aplicação.
              </p>
            </div>
          )}

          <div className="mt-8 hidden items-center justify-center gap-3 md:flex">
            {!shouldAutoRedirect && (
              <a
                href={retryHref}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold tracking-wide text-slate-800"
              >
                TENTAR NOVAMENTE
              </a>
            )}
            <a
              href={redirectHref}
              className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-semibold tracking-wide text-white"
            >
              FINALIZAR O PEDIDO
            </a>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-4 flex flex-col items-center gap-2 px-6 md:hidden">
        {!shouldAutoRedirect && (
          <a
            href={retryHref}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold tracking-wide text-slate-800"
          >
            TENTAR NOVAMENTE
          </a>
        )}
        <a
          href={redirectHref}
          className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm font-semibold tracking-wide"
        >
          FINALIZAR O PEDIDO
        </a>
      </div>
    </section>
  );
}
