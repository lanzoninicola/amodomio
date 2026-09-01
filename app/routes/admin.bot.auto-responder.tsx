import { Link, Outlet, useLocation } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import Container from "~/components/layout/container/container";

const navigation = [
  { value: "list", label: "Regras", to: "/admin/bot/auto-responder" },
  { value: "new", label: "Nova regra", to: "/admin/bot/auto-responder/new" },
  {
    value: "settings",
    label: "Configurações",
    to: "/admin/bot/auto-responder/settings",
  },
];

export default function AutoResponderLayout() {
  const { pathname } = useLocation();
  const value = pathname.includes("/new")
    ? "new"
    : pathname.includes("/settings")
    ? "settings"
    : pathname.match(/\/[a-z0-9-]+\/edit$/i)
    ? "edit"
    : "list";

  return (
    <Container fullWidth className="px-4">
      <div className="mb-12 flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/admin/bot"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
            >
              <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                <ChevronLeft size={12} />
              </span>
              voltar
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">bot</span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                WPP • Auto-responder
              </h1>
              <p className="text-sm text-slate-500">
                Gerencie regras, horários e mensagens automáticas.
              </p>
            </div>

            <nav className="overflow-x-auto border-b border-slate-200">
              <div className="flex min-w-max items-center gap-8">
                {navigation.map((item) => {
                  const isActive =
                    value === item.value ||
                    (value === "edit" && item.value === "list");

                  return (
                    <Link
                      key={item.value}
                      to={item.to}
                      className={`inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition ${
                        isActive
                          ? "border-sky-500 text-slate-950"
                          : "border-transparent text-slate-400 hover:text-slate-700"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </section>

        <Outlet />
      </div>
    </Container>
  );
}
