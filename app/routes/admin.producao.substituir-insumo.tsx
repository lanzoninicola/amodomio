import {
  defer,
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  Await,
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { Suspense, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { authenticator } from "~/domain/auth/google.server";
import { replaceRecipeIngredient } from "~/domain/recipe/replace-ingredient.server";
import db from "~/lib/prisma/client.server";

async function loadData(source: string) {
  const [items, recipes] = await Promise.all([
    db.item.findMany({
      where: {
        OR: [
          { archivedAt: null, active: true },
          { RecipeIngredient: { some: {} } },
        ],
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        consumptionUm: true,
        active: true,
        archivedAt: true,
      },
    }),
    source
      ? db.recipe.findMany({
          where: {
            status: { not: "archived" },
            RecipeIngredient: { some: { ingredientItemId: source } },
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
            itemId: true,
            RecipeIngredient: {
              select: {
                ingredientItemId: true,
                RecipeVariationIngredient: {
                  select: {
                    quantity: true,
                    unit: true,
                    ItemVariation: {
                      select: { Variation: { select: { name: true } } },
                    },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  return { items, recipes };
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    throw new Response("Não autorizado", { status: 401 });
  const source = new URL(request.url).searchParams.get("insumo") || "";
  return defer({ source, data: loadData(source) });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    throw new Response("Não autorizado", { status: 401 });
  const form = await request.formData();
  try {
    const count = await replaceRecipeIngredient(
      db,
      String(form.get("source") || ""),
      String(form.get("target") || ""),
      form.getAll("recipeId").map(String)
    );
    return json({
      success: true,
      message: `Insumo substituído em ${count} receita(s). Quantidades, unidades e perdas preservadas. As fichas vinculadas foram sinalizadas para recálculo.`,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return json(
      {
        success: false,
        message:
          code === "P2034" || code === "P2002"
            ? "A composição foi alterada durante a operação. Atualize a página e tente novamente."
            : error instanceof Error
            ? error.message
            : "Não foi possível substituir o insumo.",
      },
      { status: 400 }
    );
  }
}

type Data = Awaited<ReturnType<typeof loadData>>;
function ItemPicker({
  label,
  items,
  value,
  onChange,
  disabled,
}: {
  label: string;
  items: Data["items"];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const selected = items.find((item) => item.id === value);
  const matches = items.filter((item) =>
    item.name
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR"))
  );
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{label}</h2>
      <Input
        aria-label={label}
        placeholder="Buscar insumo pelo nome..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
      />
      {selected && (
        <p className="text-sm font-medium">
          Selecionado: {selected.name} (
          {selected.consumptionUm || "UM não definida"})
        </p>
      )}
      <div className="max-h-48 overflow-y-auto rounded border">
        {matches.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            aria-pressed={value === item.id}
            className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
              value === item.id ? "bg-muted font-semibold" : ""
            }`}
            onClick={() => onChange(item.id)}
          >
            {item.name}{" "}
            <span className="text-muted-foreground">{item.consumptionUm}</span>
          </button>
        ))}
        {!matches.length && (
          <p className="p-3 text-sm">Nenhum insumo encontrado.</p>
        )}
      </div>
    </div>
  );
}

type TabKey = "source" | "recipes" | "target" | "confirm";

const TAB_COLORS: Record<
  TabKey,
  { dot: string; activeBorder: string; activeText: string }
> = {
  source: {
    dot: "bg-sky-400",
    activeBorder: "border-sky-600",
    activeText: "text-sky-900",
  },
  recipes: {
    dot: "bg-emerald-500",
    activeBorder: "border-emerald-600",
    activeText: "text-emerald-900",
  },
  target: {
    dot: "bg-amber-400",
    activeBorder: "border-amber-500",
    activeText: "text-amber-900",
  },
  confirm: {
    dot: "bg-violet-400",
    activeBorder: "border-violet-500",
    activeText: "text-violet-900",
  },
};

function Workspace({ data, source }: { data: Data; source: string }) {
  const [, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>(
    source ? "recipes" : "source"
  );
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const sourceItem = data.items.find((item) => item.id === source);
  const targetItem = data.items.find((item) => item.id === target);
  const conflict = (recipe: Data["recipes"][number]) =>
    target &&
    (recipe.itemId === target ||
      recipe.RecipeIngredient.some((line) => line.ingredientItemId === target));
  const eligible = data.recipes.filter((recipe) => !conflict(recipe));
  const selectedIds = selected.filter((id) =>
    eligible.some((recipe) => recipe.id === id)
  );
  const hasSource = Boolean(sourceItem);
  const hasRecipes = Boolean(data.recipes.length);

  const tabs: { key: TabKey; label: string; enabled: boolean }[] = [
    { key: "source", label: "1. Insumo atual", enabled: true },
    {
      key: "recipes",
      label: `2. Receitas (${data.recipes.length})`,
      enabled: hasSource,
    },
    { key: "target", label: "3. Novo insumo", enabled: hasSource && hasRecipes },
    { key: "confirm", label: "4. Confirmar", enabled: hasSource && hasRecipes },
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b border-slate-200 px-1">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const color = TAB_COLORS[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              disabled={!tab.enabled}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? `border-b-2 font-semibold ${color.activeBorder} ${color.activeText}`
                  : tab.enabled
                  ? "font-medium text-slate-400 hover:text-slate-600"
                  : "cursor-not-allowed font-medium text-slate-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${color.dot} ${
                  isActive ? "" : "opacity-50"
                }`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "source" && (
        <ItemPicker
          label="Procure o insumo atual"
          items={data.items}
          value={source}
          disabled={busy}
          onChange={(id) => {
            setParams({ insumo: id });
            setActiveTab("recipes");
          }}
        />
      )}

      {activeTab === "recipes" && sourceItem && (
        <section className="space-y-3">
          <h2 className="font-semibold">
            Selecione as receitas ({data.recipes.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            A troca será aplicada diretamente às receitas selecionadas,
            incluindo todas as variações. Receitas arquivadas não são
            exibidas.
          </p>
          {!!eligible.length && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                setSelected(
                  selectedIds.length === eligible.length
                    ? []
                    : eligible.map((recipe) => recipe.id)
                )
              }
            >
              {selectedIds.length === eligible.length
                ? "Desmarcar todas"
                : "Selecionar todas"}
            </Button>
          )}
          {!data.recipes.length && <p>Nenhuma receita contém esse insumo.</p>}
          {data.recipes.map((recipe) => (
            <div key={recipe.id} className="rounded border p-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  disabled={busy || Boolean(conflict(recipe))}
                  checked={selectedIds.includes(recipe.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, recipe.id]
                        : selected.filter((id) => id !== recipe.id)
                    )
                  }
                />
                <span>
                  {recipe.name}{" "}
                  <span className="text-sm text-muted-foreground">
                    v{recipe.version} ·{" "}
                    {recipe.status === "active" ? "Ativa" : "Rascunho"}
                  </span>
                </span>
              </label>
              <Link
                className="text-xs underline"
                to={`/admin/recipes/${recipe.id}/variacoes`}
                target="_blank"
                rel="noreferrer"
              >
                Ver receita
              </Link>
              <div className="mt-2 text-sm text-muted-foreground">
                {recipe.RecipeIngredient.find(
                  (line) => line.ingredientItemId === source
                )?.RecipeVariationIngredient.map((line, index) => (
                  <span className="mr-4 inline-block" key={index}>
                    {line.ItemVariation.Variation.name}:{" "}
                    {line.quantity.toLocaleString("pt-BR", {
                      maximumFractionDigits: 6,
                    })}{" "}
                    {line.unit}
                  </span>
                ))}
              </div>
              {conflict(recipe) && (
                <p className="text-sm text-destructive">
                  O novo insumo já está na composição ou é o próprio item da
                  receita.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {activeTab === "target" && sourceItem && !!data.recipes.length && (
        <ItemPicker
          label="Selecione o novo insumo"
          items={data.items.filter(
            (item) => item.id !== source && item.active && !item.archivedAt
          )}
          value={target}
          disabled={busy}
          onChange={(id) => {
            setTarget(id);
            setActiveTab("confirm");
          }}
        />
      )}

      {activeTab === "confirm" && sourceItem && !!data.recipes.length && (
        <section className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Confirmar substituição</h2>
          <p>
            {sourceItem.name} → {targetItem?.name || "Selecione o novo insumo"}{" "}
            · {selectedIds.length} receita(s)
          </p>
          <p className="text-sm text-muted-foreground">
            As quantidades, unidades e perdas atuais serão mantidas em todas
            as variações, sem conversão de unidade.
          </p>
          {targetItem &&
            sourceItem.consumptionUm !== targetItem.consumptionUm && (
              <p className="text-sm font-medium">
                Os insumos têm unidades de consumo diferentes. Confira as
                unidades das variações acima antes de substituir.
              </p>
            )}
          <Button
            disabled={busy || !target || !selectedIds.length}
            onClick={() => {
              const form = new FormData();
              form.set("source", source);
              form.set("target", target);
              selectedIds.forEach((id) => form.append("recipeId", id));
              fetcher.submit(form, { method: "post" });
            }}
          >
            {busy ? "Substituindo..." : "Confirmar substituição"}
          </Button>
        </section>
      )}

      {fetcher.data && (
        <p
          role="status"
          className={
            fetcher.data.success ? "text-green-700" : "text-destructive"
          }
        >
          {fetcher.data.message}
        </p>
      )}
    </div>
  );
}

export default function ReplaceIngredientPage() {
  const { source, data } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Substituir insumo nas receitas
        </h1>
        <p className="text-muted-foreground">
          Troque um insumo em várias composições mantendo as quantidades por
          variação.
        </p>
      </header>
      <Suspense key={source} fallback={<p>Carregando insumos e receitas...</p>}>
        <Await
          resolve={data}
          errorElement={
            <p role="alert">
              Não foi possível carregar os dados. Atualize a página para tentar
              novamente.
            </p>
          }
        >
          {(resolved) => (
            <Workspace key={source} data={resolved} source={source} />
          )}
        </Await>
      </Suspense>
    </main>
  );
}
