import { Link, NavLink, Outlet } from "@remix-run/react";
import { ChevronLeft, LayoutGrid, List, PlusCircle } from "lucide-react";
import Container from "~/components/layout/container/container";
import { cn } from "~/lib/utils";

export default function RecipesOutlet() {
  return (
    <Container fullWidth className="mt-12 px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 pb-5">
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
              <span className="font-medium text-slate-900">receitas</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="new"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <PlusCircle size={15} />
                Nova receita
              </Link>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Receitas
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Cadastro, composição e variações das receitas vinculadas aos
              itens.
            </p>
          </div>

          <nav className="overflow-x-auto border-b border-slate-100">
            <div className="flex min-w-max items-center gap-6 text-sm">
              <NavLink
                to="/admin/recipes"
                end
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 border-b-2 pb-3 font-medium transition",
                    isActive
                      ? "border-slate-950 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  )
                }
              >
                <List size={14} />
                lista
              </NavLink>
              <NavLink
                to="/admin/recipes/worksheet"
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 border-b-2 pb-3 font-medium transition",
                    isActive
                      ? "border-slate-950 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  )
                }
              >
                <LayoutGrid size={14} />
                worksheet
              </NavLink>
            </div>
          </nav>
        </section>

        <Outlet />
      </div>
    </Container>
  );
}
