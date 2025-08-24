// app/routes/admin.kds.cozinha.tsx
import { defer } from "@remix-run/node";
import {
  Await,
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
  useLocation,
  useRevalidator,
} from "@remix-run/react";
import React, { Suspense, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, SquareMenu } from "lucide-react";

/* Dialog (shadcn) */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { Separator } from "~/components/ui/separator";

/* ===== Helpers de data ===== */
function pad2(n: number) { return String(n).padStart(2, "0"); }
function formatLocalDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d: Date, days: number) { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; }
function humanDayLabel(d: Date) {
  const dd = pad2(d.getDate()), mm = pad2(d.getMonth() + 1);
  const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${dd}/${mm} (${wk})`;
}

/* ===== Tipos ===== */
type FlavorRow = {
  id: string;
  name: string;
  ingredients: string; // string já “pronta” para exibir
};

/* IMPORT — ajuste se seu caminho for diferente */

/* ===== Loader: janela curta (-5 a +3) de dias + sabores visíveis ===== */
export async function loader() {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  const start = addDays(today, -5);
  const end = addDays(today, +3);

  const days: { dateStr: string; label: string }[] = [];
  for (let dt = new Date(start); dt <= end; dt = addDays(dt, 1)) {
    days.push({ dateStr: formatLocalDate(dt), label: humanDayLabel(dt) });
  }

  // Sabores ativos (visíveis) do cardápio
  const items = await menuItemPrismaEntity.findAll({
    where: { visible: true },
    option: { sorted: true, direction: "asc" }
  });

  // Normaliza para { id, name, ingredients }
  const flavors: FlavorRow[] = (items || []).map((it: any) => {
    const name = String(it?.name ?? "");
    // tenta cobrir formatos comuns de armazenamento de ingredientes
    const ingredients =
      Array.isArray(it?.ingredients) ? it.ingredients.join(", ")
        : (typeof it?.ingredients === "string" && it.ingredients) ? it.ingredients
          : Array.isArray(it?.recipe?.ingredients) ? it.recipe.ingredients.join(", ")
            : String(it?.ingredientsText ?? it?.description ?? "");
    const id = String(it?.id ?? it?.slug ?? name);
    return { id, name, ingredients };
  });

  return defer({ days, today: todayStr, flavors });
}

/* ===== Página (topbar sticky: Select + Atualizar + Ver ingredientes) ===== */
export default function CozinhaWrapper() {
  const data = useLoaderData<typeof loader>();
  const { date } = useParams();               // pode estar undefined
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { revalidate, state } = useRevalidator();

  // ❗Não definimos mais valor inicial: placeholder aparece até o usuário escolher
  const selectedDate = date ?? undefined;

  // ====== Dados para o Dialog de ingredientes ======
  const flavors = (data.flavors ?? []) as FlavorRow[];

  // Mapa por inicial (apenas ativas) e âncoras p/ scroll
  const groups = useMemo(() => {
    const map = new Map<string, FlavorRow[]>();
    for (const f of flavors) {
      const initial = (f.name?.trim()[0] ?? "").toUpperCase();
      if (!initial) continue;
      if (!map.has(initial)) map.set(initial, []);
      map.get(initial)!.push(f);
    }
    // ordena por nome dentro do grupo
    for (const v of map.values()) v.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    // retorna chaves ordenadas
    const initials = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { map, initials };
  }, [flavors]);

  // refs de seção para scroll
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [open, setOpen] = useState(false);

  function scrollToLetter(letter: string) {
    const el = sectionRefs.current[letter];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="min-h-screen">
      {/* Topbar fixa */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-2 p-2">
          <Select
            value={selectedDate} // undefined => mostra placeholder
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
            variant="default"
            onClick={() => revalidate()}
            title="Atualizar agora"
            className="shrink-0"
            disabled={state === "loading"}
          >
            <RefreshCw className={`w-5 h-5 ${state === "loading" ? "animate-spin" : ""}`} />
          </Button>

          {/* Botão Ver ingredientes */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" className="shrink-0">
                <SquareMenu />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="p-0 max-w-2xl w-[95vw] h-[92vh] sm:h-[90vh] overflow-hidden"
            >

              {/* Header fixo dentro do dialog: título + alfabetos */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">

                {/* Faixa de letras — grandes e com wrap */}
                <div className="py-4 px-2 pb-2">
                  <div className="flex flex-wrap gap-2">
                    {groups.initials.map((ltr) => (
                      <Button
                        key={ltr}
                        type="button"
                        variant="secondary"
                        className="h-12 w-12 text-2xl font-semibold rounded-md"
                        onClick={() => scrollToLetter(ltr)}
                        title={`Ir para ${ltr}`}
                      >
                        {ltr}
                      </Button>
                    ))}
                    {groups.initials.length === 0 && (
                      <Badge variant="secondary" className="text-base py-2">
                        Nenhum sabor ativo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista rolável — todas as seções visíveis, ingredientes sempre à mostra */}
              <div className="overflow-y-auto h-full pb-24 px-2">
                {groups.initials.map((ltr) => {
                  const list = groups.map.get(ltr)!;
                  return (
                    <div
                      key={ltr}
                      ref={(el) => (sectionRefs.current[ltr] = el)}
                      className="pt-3"
                    >
                      <div className="px-2 py-2">
                        <div className="text-2xl font-extrabold">{ltr}</div>
                      </div>

                      <ul className="space-y-3 px-2">
                        {list.map((f) => (
                          <li
                            key={f.id}
                          >
                            <div className="text-lg uppercase tracking-wider sm:text-xl font-semibold leading-tight">
                              {f.name}
                            </div>
                            <div className="mt-1 text-base sm:text-lg text-slate-700">
                              {f.ingredients ? f.ingredients : <span className="text-slate-400">— sem ingredientes cadastrados —</span>}
                            </div>
                            <Separator className="my-2" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

                {groups.initials.length === 0 && (
                  <div className="px-4 py-8 text-center text-slate-500">
                    Nenhum sabor visível no cardápio.
                  </div>
                )}
              </div>

              {/* Rodapé fixo com botão Fechar (grande) */}
              <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t p-3">
                <div className="max-w-2xl mx-auto">
                  <DialogClose asChild>
                    <Button type="button" className="w-full h-12 text-lg font-semibold">
                      Fechar
                    </Button>
                  </DialogClose>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
    </div>
  );
}
