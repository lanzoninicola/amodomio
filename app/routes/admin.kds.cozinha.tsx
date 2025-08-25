// app/routes/admin.kds.cozinha.tsx
import { defer, json, MetaFunction, type ActionFunctionArgs } from "@remix-run/node";
import {
  Await,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
  useLocation,
  useRevalidator,
} from "@remix-run/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MenuSquare, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ✅ import exato solicitado
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";


export const meta: MetaFunction = () => {
  return [
    { title: "KDS | Cozinha" },
  ];
};

/* ===== Helpers de data ===== */
function pad2(n: number) { return String(n).padStart(2, "0"); }
function formatLocalDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d: Date, days: number) { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; }
function humanDayLabel(d: Date) {
  const dd = pad2(d.getDate()), mm = pad2(d.getMonth() + 1);
  const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${dd}/${mm} (${wk})`;
}

/* ===== Normalização de inicial ===== */
function initialOf(name?: string) {
  const ch = (name ?? "").trim().charAt(0);
  if (!ch) return "";
  return ch.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
}

/* =========================================================================================
 * ACTION — on-demand APENAS UMA VEZ (ao abrir a dialog):
 *  - "_action" = "ingredients:all" → retorna todos os itens {id, name, ingredientsText}
 * =======================================================================================*/
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const act = String(form.get("_action") || "");

  if (act === "ingredients:all") {
    const items = await menuItemPrismaEntity.findAll({
      option: { sorted: true, direction: "asc" },
    });

    const normalized = (items as any[]).map((i) => ({
      id: String(i?.id ?? ""),
      name: String(i?.name ?? i?.title ?? "—"),
      ingredientsText: String(
        i?.ingredients ??
        i?.ingredientsText ??
        i?.composition ??
        i?.descricao ??
        i?.description ??
        ""
      ),
    }));

    return json({ items: normalized });
  }

  return json({ ok: false, error: "Ação inválida" }, { status: 400 });
}

/* ===== Loader: só datas (consulta leve; nada de cardápio aqui) ===== */
export async function loader() {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  const start = addDays(today, -5);
  const end = addDays(today, +3);

  const days: { dateStr: string; label: string }[] = [];
  for (let dt = new Date(start); dt <= end; dt = addDays(dt, 1)) {
    days.push({ dateStr: formatLocalDate(dt), label: humanDayLabel(dt) });
  }

  return defer({ days, today: todayStr });
}

/* ====================== Dialog de Ingredientes (carrega tudo 1x, filtra no cliente) ====================== */
type Item = { id: string; name: string; ingredientsText: string };

function IngredientsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const allFx = useFetcher<{ items: Item[] }>();
  const [selected, setSelected] = useState<string>("");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // carrega TODOS os itens apenas quando abrir
  useEffect(() => {
    if (open && allFx.state === "idle" && !allFx.data) {
      const fd = new FormData();
      fd.set("_action", "ingredients:all");
      allFx.submit(fd, { method: "post" });
    }
  }, [open, allFx.state, allFx.data]);

  const items = allFx.data?.items ?? [];

  // letras disponíveis e seleção inicial
  const initials = useMemo(
    () =>
      Array.from(new Set(items.map((i) => initialOf(i.name))))
        .filter(Boolean)
        .sort(),
    [items]
  );

  useEffect(() => {
    if (open && !selected && initials.length > 0) {
      setSelected(initials[0]);
    }
  }, [open, selected, initials]);

  // lista filtrada pela letra
  const list = useMemo(
    () => (selected ? items.filter((i) => initialOf(i.name) === selected) : []),
    [items, selected]
  );

  // ao trocar de letra/lista, volta topo
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 w-[100vw] max-w-[720px] h-[92dvh] sm:h-[90vh] max-h-[100dvh] md:max-h-[100vh] flex flex-col">
        {/* Header fixo */}
        <DialogHeader className="sticky top-0 z-20 bg-white border-b">
          <DialogTitle className="px-3 py-3 text-lg sm:text-xl">
            Ingredientes por sabor
          </DialogTitle>

          {/* Barra de letras — grandes, semibold, rounded-md, cinza claro, com wrap */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-6 gap-2">
              {initials.map((ltr) => {
                const active = selected === ltr;
                return (
                  <button
                    key={ltr}
                    type="button"
                    onClick={() => setSelected(ltr)}
                    className={[
                      "px-3 py-2 h-10",
                      "text-xl font-semibold",
                      "rounded-md",
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-900",
                      "focus-visible:outline-none focus-visible:ring-0",
                    ].join(" ")}
                    title={`Letra ${ltr}`}
                  >
                    {ltr}
                  </button>
                );
              })}
              {allFx.state !== "idle" && !allFx.data && (
                <div className="text-xs text-slate-500 py-2">Carregando…</div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Corpo rolável ocupa todo o restante */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-3 py-3">
          {!allFx.data && allFx.state !== "idle" && (
            <div className="text-sm text-slate-500">Carregando sabores…</div>
          )}

          {allFx.data && selected === "" && (
            <div className="text-sm text-slate-500">Selecione uma letra.</div>
          )}

          {allFx.data && selected !== "" && list.length === 0 && (
            <div className="text-sm text-slate-500">
              Nenhum sabor com a letra “{selected}”.
            </div>
          )}

          {list.map((it, idx) => {
            const ingredients = String(it.ingredientsText || "")
              .replace(/[\n\r]+/g, ", ")
              .replace(/[;•·]/g, ",")
              .replace(/\s*,\s*/g, ", ")
              .replace(/\s{2,}/g, " ")
              .trim();

            return (
              <div key={it.id} className="py-2">
                <div className="text-lg sm:text-xl font-semibold leading-tight mb-1">
                  {it.name}
                </div>
                <div className="text-base sm:text-lg text-slate-700 leading-6 break-words">
                  {ingredients || (
                    <span className="text-slate-500 text-sm">
                      (sem ingredientes cadastrados)
                    </span>
                  )}
                </div>

                {idx < list.length - 1 && <Separator className="my-3" />}
              </div>
            );
          })}
        </div>

        {/* Rodapé embaixo */}
        <div className="p-2">
          <Button className="w-full h-12 text-base" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Página (topbar sticky: Select + Atualizar + ícone de ingredientes) ===== */
export default function CozinhaWrapper() {
  const data = useLoaderData<typeof loader>();
  const { date } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { revalidate, state } = useRevalidator();

  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const selectedDate = date ?? undefined;

  return (
    <div className="min-h-screen">
      {/* Topbar fixa */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-2 p-2">
          <Select
            value={selectedDate}
            onValueChange={(val) => navigate(`/admin/kds/cozinha/${val}`)}
          >
            <SelectTrigger className="w-full h-12 text-base">
              <SelectValue placeholder="Selecione a data" />
            </SelectTrigger>
            <SelectContent className="max-h-[55vh]">
              {data.days.map((d) => (
                <SelectItem
                  key={d.dateStr}
                  value={d.dateStr}
                  className="text-base py-3"
                >
                  {d.label}{d.dateStr === data.today ? " — Hoje" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            onClick={() => revalidate()}
            title="Atualizar agora"
            className="shrink-0"
            disabled={state === "loading"}
          >
            <RefreshCw className={`w-5 h-5 ${state === "loading" ? "animate-spin" : ""}`} />
          </Button>

          {/* Ícone (MenuSquare) para abrir a dialog de ingredientes */}
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={() => setIngredientsOpen(true)}
            title="Ver ingredientes dos sabores"
            aria-label="Ver ingredientes dos sabores"
          >
            <MenuSquare className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Conteúdo rolável: só renderiza algo quando houver :date */}
      <div className="max-w-md mx-auto">
        <Suspense fallback={<div>Carregando…</div>}>
          <Await resolve={data.days}>
            {() => (selectedDate ? <Outlet key={pathname} /> : null)}
          </Await>
        </Suspense>
      </div>

      {/* Dialog on-demand (1 requisição total ao abrir) */}
      <IngredientsDialog open={ingredientsOpen} onOpenChange={setIngredientsOpen} />
    </div>
  );
}
