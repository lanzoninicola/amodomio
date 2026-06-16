import type { MetaFunction } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";
import { ChevronLeft, PlusCircle } from "lucide-react";
import Container from "~/components/layout/container/container";

export const meta: MetaFunction = () => [
  { title: "Destaques do cardápio | Marketing" },
];

export default function AdminMarketingCardapioHighlightsLayout() {
  return (
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">marketing</span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">
                destaques do cardápio
              </span>
            </div>

            <Link
              to="new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <PlusCircle size={15} />
              Novo destaque
            </Link>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">
              Destaques do cardápio
            </h1>
            <p className="text-sm text-slate-500">
              Gerencie as seções promocionais publicadas na página pública do
              cardápio.
            </p>
          </div>
        </section>

        <Outlet />
      </div>
    </Container>
  );
}
