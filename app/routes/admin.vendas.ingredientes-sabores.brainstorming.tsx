import {
  defer,
  json,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  useAsyncError,
  useFetcher,
  useLoaderData,
  useRevalidator,
} from "@remix-run/react";
import {
  Check,
  Download,
  Printer,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { Suspense, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Produção | Brainstorming de sabores" },
];

const REPORT_WINDOW_DAYS = 90;
const BRAINSTORMING_SETTINGS_CONTEXT = "menu-engineering";
const BRAINSTORMING_NOTES_SETTING = "brainstormingNotes";

async function ensureBrainstormingNotesSetting() {
  const existing = await prismaClient.setting.findFirst({
    where: {
      context: BRAINSTORMING_SETTINGS_CONTEXT,
      name: BRAINSTORMING_NOTES_SETTING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return existing;

  return prismaClient.setting.create({
    data: {
      context: BRAINSTORMING_SETTINGS_CONTEXT,
      name: BRAINSTORMING_NOTES_SETTING,
      type: "string",
      value: "",
      createdAt: new Date(),
    },
  });
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(value);
}

async function loadBrainstormingSheet() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REPORT_WINDOW_DAYS);

  const [cardapioChannel, imports, notesSetting] = await Promise.all([
    prismaClient.itemSellingChannel.findFirst({
      where: { key: "cardapio" },
      select: { id: true, name: true },
    }),
    prismaClient.menuEngineeringImport.findMany({
      where: { periodEnd: { gte: cutoff } },
      select: {
        periodStart: true,
        periodEnd: true,
        items: {
          select: { topping: true, quantity: true },
        },
      },
      orderBy: { periodStart: "asc" },
    }),
    ensureBrainstormingNotesSetting(),
  ]);

  if (!cardapioChannel) {
    throw new Error("O canal Cardápio não foi encontrado.");
  }

  const flavors = await prismaClient.item.findMany({
    where: {
      ItemSellingChannelItem: {
        some: {
          itemSellingChannelId: cardapioChannel.id,
          visible: true,
        },
      },
      ItemVariation: {
        some: {
          deletedAt: null,
          Recipe: { is: { type: "pizzaTopping" } },
        },
      },
    },
    select: {
      id: true,
      name: true,
      ItemVariation: {
        where: {
          deletedAt: null,
          Recipe: { is: { type: "pizzaTopping" } },
        },
        select: {
          Recipe: {
            select: {
              id: true,
              RecipeIngredient: {
                orderBy: { sortOrderIndex: "asc" },
                select: {
                  IngredientItem: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const flavorByKey = new Map(
    flavors.map((flavor) => {
      const ingredients = new Map<string, string>();
      const recipeIds = new Set<string>();
      for (const variation of flavor.ItemVariation) {
        const recipe = variation.Recipe;
        if (!recipe) continue;
        recipeIds.add(recipe.id);
        for (const row of recipe.RecipeIngredient) {
          if (row.IngredientItem?.id) {
            ingredients.set(row.IngredientItem.id, row.IngredientItem.name);
          }
        }
      }
      return [
        normalize(flavor.name),
        {
          id: flavor.id,
          name: flavor.name,
          ingredients: Array.from(ingredients.values()),
          ingredientIds: Array.from(ingredients.keys()),
          recipeCount: recipeIds.size,
        },
      ] as const;
    })
  );

  const salesByFlavor = new Map<string, number>();
  for (const reportImport of imports) {
    for (const item of reportImport.items) {
      const key = normalize(item.topping);
      if (!flavorByKey.has(key)) continue;
      salesByFlavor.set(key, (salesByFlavor.get(key) || 0) + item.quantity);
    }
  }

  const topFlavors = Array.from(salesByFlavor.entries())
    .map(([key, quantity]) => ({ ...flavorByKey.get(key)!, quantity }))
    .sort(
      (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "pt-BR")
    )
    .slice(0, 10);

  const ingredientUsage = new Map<
    string,
    { name: string; flavorIds: Set<string>; flavorNames: Set<string> }
  >();
  for (const flavor of flavorByKey.values()) {
    flavor.ingredientIds.forEach((ingredientId, index) => {
      const current = ingredientUsage.get(ingredientId) || {
        name: flavor.ingredients[index],
        flavorIds: new Set<string>(),
        flavorNames: new Set<string>(),
      };
      current.flavorIds.add(flavor.id);
      current.flavorNames.add(flavor.name);
      ingredientUsage.set(ingredientId, current);
    });
  }

  const ingredientReferences = Array.from(ingredientUsage.values())
    .map((ingredient) => ({
      name: ingredient.name,
      usageCount: ingredient.flavorIds.size,
      flavors: Array.from(ingredient.flavorNames).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "pt-BR") || a.usageCount - b.usageCount
    );

  const leastUsedIngredients = ingredientReferences.filter(
    (ingredient) => ingredient.usageCount === 1
  );

  const pairCounts = new Map<
    string,
    { names: [string, string]; score: number }
  >();
  for (const flavor of topFlavors) {
    const names = [...flavor.ingredients].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
    for (let left = 0; left < names.length; left += 1) {
      for (let right = left + 1; right < names.length; right += 1) {
        const key = `${normalize(names[left])}|${normalize(names[right])}`;
        const current = pairCounts.get(key) || {
          names: [names[left], names[right]] as [string, string],
          score: 0,
        };
        current.score += flavor.quantity;
        pairCounts.set(key, current);
      }
    }
  }

  const combinations = Array.from(pairCounts.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const periodStart = imports[0]?.periodStart || null;
  const periodEnd = imports[imports.length - 1]?.periodEnd || null;

  return {
    generatedAt: formatDate(new Date()),
    channelName: cardapioChannel.name,
    periodLabel:
      periodStart && periodEnd
        ? `${formatDate(periodStart)} a ${formatDate(periodEnd)}`
        : "Sem importações de vendas nos últimos 90 dias",
    flavorCount: flavors.length,
    notes: notesSetting.value,
    ingredientReferences,
    leastUsedIngredients,
    topFlavors,
    combinations,
  };
}

export function loader() {
  return defer({ payload: loadBrainstormingSheet() });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  if (formData.get("_action") !== "saveNotes") {
    return json({ ok: false, error: "Ação inválida." }, { status: 400 });
  }

  const notes = String(formData.get("notes") || "");
  if (notes.length > 50_000) {
    return json(
      { ok: false, error: "As notas excedem o limite de 50.000 caracteres." },
      { status: 400 }
    );
  }

  const setting = await ensureBrainstormingNotesSetting();
  await prismaClient.setting.update({
    where: { id: setting.id },
    data: { type: "string", value: notes },
  });

  return json({ ok: true, error: null });
}

function SheetError() {
  const error = useAsyncError();
  const revalidator = useRevalidator();
  const reason =
    error instanceof Error
      ? error.message
      : "O servidor não informou detalhes sobre a falha.";

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">Não foi possível montar a folha.</p>
      <p className="mt-1">{reason}</p>
      <button
        type="button"
        onClick={() => revalidator.revalidate()}
        disabled={revalidator.state !== "idle"}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 font-medium disabled:opacity-60"
      >
        <RefreshCw className="h-4 w-4" />
        {revalidator.state === "idle" ? "Recarregar" : "Recarregando…"}
      </button>
    </div>
  );
}

function BrainstormingSheet({
  report,
}: {
  report: Awaited<ReturnType<typeof loadBrainstormingSheet>>;
}) {
  const notesFetcher = useFetcher<typeof action>();
  const [notes, setNotes] = useState(report.notes);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const isSaving = notesFetcher.state !== "idle";
  const normalizedIngredientSearch = normalize(ingredientSearch);
  const ingredientMatches = normalizedIngredientSearch
    ? report.ingredientReferences
        .filter((ingredient) =>
          normalize(ingredient.name).includes(normalizedIngredientSearch)
        )
        .slice(0, 8)
    : [];

  return (
    <article
      id="brainstorming-sheet"
      className="w-full bg-white p-5 text-slate-950 print:p-0"
    >
      <header className="flex items-end justify-between border-b-2 border-slate-900 pb-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">
            Amodomio · criação de produto
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Brainstorming de novos sabores
          </h1>
        </div>
        <div className="text-right text-[10px] leading-4 text-slate-500">
          <p>
            {report.channelName} · {report.flavorCount} sabores visíveis
          </p>
          <p>Vendas: {report.periodLabel}</p>
          <p>Impresso em {report.generatedAt}</p>
        </div>
      </header>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] print:grid-cols-[0.9fr_1.1fr]">
        <div className="grid grid-cols-2 items-start gap-3">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none">
            <h2 className="text-xs font-bold uppercase tracking-wide">
              Ingredientes menos explorados
            </h2>
            <p className="mb-3 text-[9px] text-slate-500">
              Lista completa dos ingredientes presentes em apenas um sabor
              visível.
            </p>
            <ol className="space-y-1.5 text-[10px]">
              {report.leastUsedIngredients.map((ingredient, index) => (
                <li
                  key={ingredient.name}
                  className="grid grid-cols-[16px_1fr_auto] gap-1 border-b border-dotted border-slate-200 pb-1"
                >
                  <span className="text-slate-400">{index + 1}.</span>
                  <span className="font-medium">{ingredient.name}</span>
                  <span className="text-slate-500">1 sabor</span>
                </li>
              ))}
              {report.leastUsedIngredients.length === 0 ? (
                <li className="py-3 text-slate-400">
                  Nenhum ingrediente aparece em somente um sabor.
                </li>
              ) : null}
            </ol>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none">
            <h2 className="text-xs font-bold uppercase tracking-wide">
              10 sabores mais pedidos
            </h2>
            <p className="mb-3 text-[9px] text-slate-500">
              Quantidade vendida nas importações do período.
            </p>
            <ol className="space-y-1.5 text-[10px]">
              {report.topFlavors.map((flavor, index) => (
                <li
                  key={flavor.id}
                  className="border-b border-dotted border-slate-200 pb-1"
                >
                  <div className="flex justify-between gap-2">
                    <span>
                      <span className="mr-1 text-slate-400">{index + 1}.</span>
                      <strong>{flavor.name}</strong>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {flavor.quantity.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="truncate pl-4 text-[8px] text-slate-500">
                    {flavor.ingredients.join(" · ") ||
                      "Receita sem ingredientes"}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
            <label
              htmlFor="ingredient-flavor-search"
              className="text-xs font-bold uppercase tracking-wide text-slate-800"
            >
              Consultar ingrediente
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="ingredient-flavor-search"
                type="search"
                value={ingredientSearch}
                onChange={(event) => setIngredientSearch(event.target.value)}
                placeholder="Digite o nome do ingrediente…"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
              />
            </div>
            {normalizedIngredientSearch ? (
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1 text-xs">
                {ingredientMatches.length > 0 ? (
                  ingredientMatches.map((ingredient) => (
                    <div key={ingredient.name}>
                      <p className="font-semibold text-slate-800">
                        {ingredient.name}
                      </p>
                      <p className="leading-5 text-slate-500">
                        {ingredient.flavors.join(", ")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">
                    Nenhum ingrediente encontrado.
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <notesFetcher.Form
            method="post"
            className="flex min-h-[150mm] flex-1 flex-col rounded-2xl bg-amber-50/45 px-5 py-4 print:min-h-0"
          >
            <input type="hidden" name="_action" value="saveNotes" />
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="brainstorming-notes"
                className="text-lg font-semibold tracking-tight text-slate-800"
              >
                Notas
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60 print:hidden"
              >
                {notesFetcher.data?.ok ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {isSaving
                  ? "Salvando…"
                  : notesFetcher.data?.ok
                  ? "Salvo"
                  : "Salvar"}
              </button>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Escreva livremente suas ideias de novos sabores.
            </p>
            <textarea
              id="brainstorming-notes"
              name="notes"
              aria-label="Notas livres para brainstorming"
              placeholder="Comece a escrever…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "s") {
                  event.preventDefault();
                  if (!isSaving) event.currentTarget.form?.requestSubmit();
                }
              }}
              className="mt-3 min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-7 text-slate-800 outline-none placeholder:text-slate-300 focus:border-0 focus:outline-none focus:ring-0 print:text-[11px] print:leading-5"
            />
            {notesFetcher.data?.error ? (
              <p className="mt-2 text-xs text-red-600">
                {notesFetcher.data.error}
              </p>
            ) : null}
          </notesFetcher.Form>
        </div>
      </div>
    </article>
  );
}

export default function BrainstormingRoute() {
  const { payload } = useLoaderData<typeof loader>();

  return (
    <main>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 9mm; }
          body { background: white !important; }
          body > * header, body > * footer, [data-sidebar="sidebar"], [data-sidebar="trigger"] { display: none !important; }
          [data-element="outer-div-admin-outlet"] { margin: 0 !important; padding: 0 !important; }
          #brainstorming-sheet { width: 100% !important; }
          #brainstorming-sheet > header { display: flex !important; }
        }
      `}</style>
      <div className="mb-3 flex flex-wrap justify-end gap-2 print:hidden">
        <a
          href="/admin/vendas/ingredientes-sabores/brainstorming/export"
          className="inline-flex items-center gap-2 rounded-md border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50"
        >
          <Download className="h-4 w-4" /> Exportar dados para IA
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" /> Imprimir folha A4
        </button>
      </div>
      <Suspense
        fallback={
          <div className="py-16 text-center text-sm text-slate-500">
            Montando a folha de brainstorming…
          </div>
        }
      >
        <Await resolve={payload} errorElement={<SheetError />}>
          {(report) => <BrainstormingSheet report={report} />}
        </Await>
      </Suspense>
    </main>
  );
}
