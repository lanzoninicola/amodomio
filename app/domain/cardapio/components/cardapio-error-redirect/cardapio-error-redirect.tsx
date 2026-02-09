import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import Logo from "~/components/primitives/logo/logo";

type CardapioErrorRedirectProps = {
  redirectHref: string;
  redirectDelaySeconds?: number;
};

export default function CardapioErrorRedirect({
  redirectHref,
  redirectDelaySeconds = 3,
}: CardapioErrorRedirectProps) {
  const [secondsLeft, setSecondsLeft] = useState(redirectDelaySeconds);

  useEffect(() => {
    if (typeof window === "undefined") return;

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
  }, [redirectDelaySeconds, redirectHref]);

  return (
    <section className="min-h-screen flex flex-col px-6 py-6 md:py-8">
      <div className="flex justify-center pt-2 md:pt-4">
        <Logo circle={true} className="w-20 md:w-24" tagline={false} />
      </div>

      <div className="flex-1 flex items-center justify-center pb-24 md:pb-0">
        <div className="max-w-md text-center font-neue">
          <div className="flex flex-col items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <p className="mt-1 text-lg md:text-xl font-semibold leading-tight text-amber-600">
              Ocorreu um erro.
            </p>
          </div>
          <div className="mt-5 flex flex-col items-center justify-center">
            <p className="text-lg md:text-xl font-semibold leading-tight text-black">
              Estamos redirecionando você para finalizar seu pedido.
            </p>
          </div>
          <div className="mt-6 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700/80">
              Redirecionamento automático
            </p>
            <p className="text-3xl md:text-4xl font-bold text-amber-600 tracking-wide">{secondsLeft}</p>
          </div>

          <a
            href={redirectHref}
            className="mt-8 hidden md:inline-flex items-center rounded-md bg-black text-white px-4 py-2 text-sm font-semibold tracking-wide"
          >
            FINALIZAR O PEDIDO
          </a>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-6 flex justify-center md:hidden">
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
