import { Link, useLocation } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import Logo from "~/components/primitives/logo/logo";
import { getErrorMessage } from "~/lib/errors/connectivity";

type CardapioDatabaseUnavailableProps = {
  error: unknown;
};

export default function CardapioDatabaseUnavailable({
  error,
}: CardapioDatabaseUnavailableProps) {
  const location = useLocation();
  const retryHref = `${location.pathname}${location.search}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-10 md:py-16">
        <header className="flex items-center justify-between">
          <Logo onlyText={true} className="w-40 md:w-48" color="black" />
          <div className="rounded-full border border-amber-200 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 shadow-sm">
            Cardápio indisponível
          </div>
        </header>

        <main className="grid items-center gap-10 rounded-3xl border border-amber-100 bg-white/80 p-8 shadow-[0_20px_70px_rgba(17,24,39,0.08)] backdrop-blur-sm md:p-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">
              Instabilidade temporária
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                Banco temporariamente indisponível.
              </h1>
              <p className="text-lg text-slate-600 md:max-w-xl">
                A aplicação não conseguiu alcançar o banco de dados agora. Tente recarregar esta rota em instantes.
              </p>
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:max-w-xl">
                {getErrorMessage(error) || "Falha de conectividade com a base de dados."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={retryHref}
                reloadDocument
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span>Tentar novamente</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span>Ir para a página inicial</span>
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 -z-10 mx-auto h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" aria-hidden />
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-100 bg-white/80 p-6 shadow-inner">
              <img src="/images/gato-chorando.gif" alt="Gatinho triste" className="w-44 md:w-52" />
              <div className="text-sm text-slate-500">Tente novamente em alguns instantes.</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
