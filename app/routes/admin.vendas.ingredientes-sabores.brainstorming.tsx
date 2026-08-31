import { defer, type MetaFunction } from "@remix-run/node";
import {
  Await,
  useAsyncError,
  useLoaderData,
  useRevalidator,
} from "@remix-run/react";
import { Printer, RefreshCw } from "lucide-react";
import { Suspense } from "react";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Produção | Brainstorming de sabores" },
];

const REPORT_WINDOW_DAYS = 90;

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

  const [cardapioChannel, imports] = await Promise.all([
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

  const leastUsedIngredients = Array.from(ingredientUsage.values())
    .map((ingredient) => ({
      name: ingredient.name,
      usageCount: ingredient.flavorIds.size,
      flavors: Array.from(ingredient.flavorNames).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    }))
    .sort(
      (a, b) =>
        a.usageCount - b.usageCount || a.name.localeCompare(b.name, "pt-BR")
    )
    .slice(0, 10);

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
    leastUsedIngredients,
    topFlavors,
    combinations,
  };
}

export function loader() {
  return defer({ payload: loadBrainstormingSheet() });
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

function IdeaBox({ number }: { number: number }) {
  return (
    <section className="min-h-[43mm] rounded-lg border border-slate-300 p-3 print:break-inside-avoid">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-800">
        Ideia {number}
      </h2>
      <div className="mt-2 space-y-2 text-[10px] text-slate-600">
        <p>Nome: __________________________________________________</p>
        <p>Base + queijo: __________________________________________</p>
        <p>Ingrediente principal: ___________________________________</p>
        <p>Contraste / acabamento: __________________________________</p>
        <p className="tracking-wide">
          □ crocante　□ cremoso　□ picante　□ doce　□ defumado　□ fresco
        </p>
        <p>Por que deve entrar? ______________________________________</p>
      </div>
    </section>
  );
}

function BrainstormingSheet({
  report,
}: {
  report: Awaited<ReturnType<typeof loadBrainstormingSheet>>;
}) {
  return (
    <article
      id="brainstorming-sheet"
      className="mx-auto max-w-[210mm] bg-white p-5 text-slate-950 print:max-w-none print:p-0"
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

      <div className="mt-3 grid grid-cols-2 gap-3">
        <section className="rounded-lg border border-slate-300 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide">
            10 ingredientes pouco explorados
          </h2>
          <p className="mb-2 text-[9px] text-slate-500">
            Menor número de sabores visíveis que usam o ingrediente.
          </p>
          <ol className="space-y-1 text-[10px]">
            {report.leastUsedIngredients.map((ingredient, index) => (
              <li
                key={ingredient.name}
                className="grid grid-cols-[16px_1fr_auto] gap-1 border-b border-dotted border-slate-200 pb-0.5"
              >
                <span className="text-slate-400">{index + 1}.</span>
                <span className="font-medium">{ingredient.name}</span>
                <span className="text-slate-500">
                  {ingredient.usageCount} sabor(es)
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-slate-300 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide">
            10 sabores mais pedidos
          </h2>
          <p className="mb-2 text-[9px] text-slate-500">
            Quantidade vendida nas importações do período.
          </p>
          <ol className="space-y-1 text-[10px]">
            {report.topFlavors.map((flavor, index) => (
              <li
                key={flavor.id}
                className="border-b border-dotted border-slate-200 pb-0.5"
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
                  {flavor.ingredients.join(" · ") || "Receita sem ingredientes"}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
        <h2 className="text-xs font-bold uppercase tracking-wide">
          Combinações presentes nos campeões de venda
        </h2>
        <div className="mt-2 grid grid-cols-5 gap-2 text-center text-[9px] font-medium">
          {report.combinations.map((pair) => (
            <div
              key={pair.names.join("-")}
              className="rounded border border-violet-200 bg-white px-2 py-1.5"
            >
              {pair.names.join(" + ")}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <IdeaBox number={1} />
        <IdeaBox number={2} />
        <IdeaBox number={3} />
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
      <div className="mb-3 flex justify-end print:hidden">
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
