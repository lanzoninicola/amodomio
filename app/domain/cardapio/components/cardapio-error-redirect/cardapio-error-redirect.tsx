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
  const [secondsLeft, setSecondsLeft] = useState(redirectDelaySeconds);
  const shouldAutoRedirect = autoRedirectEnabled && !debugMode;
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
    <section className="flex min-h-screen flex-col bg-white px-6 py-8 text-black md:py-10">
      <div className="flex justify-center">
        <Logo
          circle={true}
          color="black"
          className="w-24 bg-white shadow-sm ring-1 ring-black/10 md:w-28"
          tagline={false}
        />
      </div>

      <div className="flex flex-1 items-center justify-center pb-10">
        <div className="w-full max-w-sm text-center font-neue">
          <p className="text-xl font-semibold leading-tight md:text-2xl">
            Vamos finalizar seu pedido.
          </p>
          <p className="mx-auto mt-3 max-w-xs text-base leading-relaxed text-slate-600">
            Se a tela não mudar sozinha, toque no botão abaixo.
          </p>

          {shouldAutoRedirect ? (
            <div className="mt-10">
              <p className="text-[7rem] font-normal leading-none tracking-normal text-black md:text-[9rem]">
                {secondsLeft}
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {!autoRedirectEnabled ? (
                <p>Toque no botão abaixo para continuar seu pedido.</p>
              ) : debugMode ? (
                <p>Pré-visualização aberta. O envio automático está pausado.</p>
              ) : (
                <p>Toque no botão abaixo para continuar seu pedido.</p>
              )}
            </div>
          )}

          <div className="mt-10 flex flex-col items-center justify-center gap-3">
            {!shouldAutoRedirect && (
              <a
                href={retryHref}
                className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800"
              >
                Tentar novamente
              </a>
            )}
            <a
              href={redirectHref}
              className="inline-flex min-h-12 items-center rounded-md bg-black px-6 py-3 text-sm font-semibold text-white"
            >
              Finalizar pedido
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
