import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import {
  Check,
  ChefHat,
  ChevronLeft,
  HelpCircle,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  name: string;
  classification: string;
  consumptionUm: string | null;
};

type IngredientSection = "base" | "filling";
const PIZZA_SIZE_OPTIONS = [
  { code: "pizza-individual", label: "Ind.", fullLabel: "Individual" },
  { code: "pizza-small", label: "Peq.", fullLabel: "Pequena" },
  { code: "pizza-medium", label: "Méd.", fullLabel: "Média" },
  { code: "pizza-bigger", label: "Fam.", fullLabel: "Família" },
] as const;
type ConfirmedIngredient = {
  key: string;
  itemId: string | null;
  name: string;
  section: IngredientSection;
  pending: boolean;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildNameSuggestions(ingredients: ConfirmedIngredient[]) {
  const names = ingredients.map((item) => item.name.trim()).filter(Boolean);
  const first = names[0];
  const second = names[1];
  if (!first) return [];

  return Array.from(
    new Set([
      second ? `${first} e ${second}` : `Pizza ${first}`,
      `${first} Speciale`,
      second ? `${first} & ${second}` : `Sabor ${first}`,
    ])
  );
}

function IngredientPicker({
  section,
  label,
  placeholder,
  catalog,
  confirmed,
  onConfirm,
  onPending,
  mobile,
}: {
  section: IngredientSection;
  label: string;
  placeholder: string;
  catalog: CatalogItem[];
  confirmed: ConfirmedIngredient[];
  onConfirm: (
    item: CatalogItem,
    section: IngredientSection,
    commercialName: string
  ) => void;
  onPending: (name: string, section: IngredientSection) => void;
  mobile: boolean;
}) {
  const [text, setText] = useState("");
  const pendingTerm = text.trim();
  const matches = useMemo(() => {
    const query = normalize(pendingTerm);
    if (query.length < 2) return [];
    return catalog
      .filter((item) => !confirmed.some((row) => row.itemId === item.id))
      .filter((item) => normalize(item.name).includes(query))
      .sort(
        (a, b) =>
          Number(normalize(b.name).startsWith(query)) -
          Number(normalize(a.name).startsWith(query))
      )
      .slice(0, 6);
  }, [catalog, confirmed, pendingTerm]);

  const confirm = (item: CatalogItem) => {
    onConfirm(item, section, pendingTerm);
    setText("");
  };
  const normalizedPendingTerm = normalize(pendingTerm);
  const canAddPending =
    normalizedPendingTerm.length >= 2 &&
    !catalog.some((item) => normalize(item.name) === normalizedPendingTerm) &&
    !confirmed.some((item) => normalize(item.name) === normalizedPendingTerm);

  return (
    <div className="relative">
      <label
        className="text-sm font-semibold text-slate-900"
        htmlFor={`pizza-flavor-${section}`}
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          type="text"
          id={`pizza-flavor-${section}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 px-3 py-3 pr-10 text-base outline-none focus:border-slate-900"
        />
        <Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" />
      </div>
      {pendingTerm.length >= 2 ? (
        <div
          className={
            mobile
              ? "mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
              : "mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg lg:absolute lg:left-[calc(100%+1.5rem)] lg:top-0 lg:z-30 lg:mt-0 lg:w-[22rem] lg:shadow-xl"
          }
        >
          {matches.length
            ? matches.map((item) => (
                <button
                  type="button"
                  onClick={() => confirm(item)}
                  key={item.id}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {item.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.classification === "semi_acabado"
                        ? "Semiacabado"
                        : "Insumo"}{" "}
                      · {item.consumptionUm || "sem unidade"}
                    </span>
                  </span>
                  <Plus className="h-5 w-5 text-slate-500" />
                </button>
              ))
            : null}
          {!matches.length ? (
            <p className="p-3 text-sm text-amber-800">
              Nenhum insumo ou semiacabado encontrado para “{pendingTerm}”.
            </p>
          ) : null}
          {canAddPending ? (
            <button
              type="button"
              onClick={() => {
                onPending(pendingTerm, section);
                setText("");
              }}
              className="flex w-full items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-3 text-left text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Plus className="h-4 w-4" />
              Adicionar “{pendingTerm}” como ingrediente pendente
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WizardHelpButton({ dark = false }: { dark?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Como funciona"
          className={`rounded-full border p-2 ${
            dark
              ? "border-slate-700 text-slate-200 hover:bg-slate-800"
              : "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Como funciona o cadastro rápido</DialogTitle>
          <DialogDescription>
            Você confirma os ingredientes da base e do recheio. O sistema reúne
            os dois na receita completa.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>• Categoria técnica: Sabor Pizza</li>
          <li>• Grupo comercial padrão: Pizzas Salgadas</li>
          <li>• Unidade de consumo do sabor: UN</li>
          <li>• Receita criada para os tamanhos selecionados</li>
          <li>• Quantidades iniciadas pela média dos sabores visíveis</li>
          <li>• Ficha técnica criada como rascunho</li>
          <li>• Lançamento futuro ativado</li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export default function PizzaFlavorWizardRoute({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  const loaderData = useLoaderData() as any;
  const actionData = useActionData() as any;
  const navigation = useNavigation();
  const catalog = (loaderData?.payload?.ingredients || []) as CatalogItem[];
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedIngredient[]>([]);
  const [variationCodes, setVariationCodes] = useState<string[]>(
    PIZZA_SIZE_OPTIONS.map((option) => option.code)
  );
  const created = actionData?.payload?.created;
  const error = actionData?.status >= 400 ? actionData?.message : null;
  const baseIngredients = confirmed.filter((item) => item.section === "base");
  const fillingIngredients = confirmed.filter(
    (item) => item.section === "filling"
  );
  const nameSuggestions = buildNameSuggestions(fillingIngredients);

  if (created) {
    return (
      <section
        className={`mx-auto ${
          mobile ? "max-w-md" : "max-w-3xl"
        } rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-950">
          {created.name} foi criado
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Item, dados comerciais, receita, ficha técnica e lançamento futuro
          estão prontos.
        </p>
        {created.temporaryName ? (
          <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            O sabor foi salvo com um nome interno. Defina o nome comercial
            durante a revisão.
          </p>
        ) : null}
        {created.pendingIngredientCount ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {created.pendingIngredientCount} ingrediente(s) ficaram pendentes de
            cadastro e não entraram na composição técnica.
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white"
            to={`/admin/items/${created.itemId}/recipes/vinculada`}
          >
            Revisar receita
          </Link>
          <Link
            className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
            to={`/admin/item-cost-sheets/${created.itemCostSheetId}`}
          >
            Abrir ficha técnica
          </Link>
        </div>
      </section>
    );
  }

  const addIngredient = (
    item: CatalogItem,
    section: IngredientSection,
    commercialName: string
  ) => {
    setConfirmed((rows) => [
      ...rows,
      {
        key: item.id,
        itemId: item.id,
        name: commercialName.trim() || item.name,
        section,
        pending: false,
      },
    ]);
  };
  const addPendingIngredient = (
    ingredientName: string,
    section: IngredientSection
  ) => {
    const trimmedName = ingredientName.trim();
    setConfirmed((rows) => [
      ...rows,
      {
        key: `pending:${section}:${normalize(trimmedName)}`,
        itemId: null,
        name: trimmedName,
        section,
        pending: true,
      },
    ]);
  };

  return (
    <section className={`mx-auto ${mobile ? "max-w-md" : "w-full"}`}>
      <div
        className={
          mobile
            ? "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            : "flex flex-col gap-6"
        }
      >
        {mobile ? (
          <header className="flex items-start justify-between gap-4 bg-slate-950 p-5 text-white">
            <div>
              <div className="flex items-center gap-2 text-amber-300">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Cadastro rápido
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-bold">Novo sabor de pizza</h2>
            </div>
            <WizardHelpButton dark />
          </header>
        ) : (
          <header className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin/items"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                itens
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">
                novo sabor de pizza
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Cadastro rápido
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  Novo sabor de pizza
                </h2>
              </div>
              <WizardHelpButton />
            </div>
          </header>
        )}

        <Form
          method="post"
          className={`space-y-6 ${
            mobile
              ? "p-5"
              : "relative rounded-2xl border border-slate-200 bg-white p-6 lg:pr-[25rem]"
          }`}
        >
          <input
            type="hidden"
            name="ingredients"
            value={JSON.stringify(
              confirmed.map((row) => ({
                itemId: row.itemId,
                name: row.name,
                section: row.section,
              }))
            )}
          />
          <input
            type="hidden"
            name="variationCodes"
            value={JSON.stringify(variationCodes)}
          />
          <div className="space-y-5">
            <IngredientPicker
              section="base"
              label="Base da pizza"
              placeholder="Molho de tomate, muçarela..."
              catalog={catalog}
              confirmed={confirmed}
              onConfirm={addIngredient}
              onPending={addPendingIngredient}
              mobile={mobile}
            />
            <IngredientPicker
              section="filling"
              label="Recheio"
              placeholder="Bacon, provolone, cebola..."
              catalog={catalog}
              confirmed={confirmed}
              onConfirm={addIngredient}
              onPending={addPendingIngredient}
              mobile={mobile}
            />
          </div>

          {confirmed.length ? (
            <div
              className={
                mobile ? "space-y-4" : "grid grid-cols-2 items-start gap-5"
              }
            >
              {(
                [
                  { title: "Base confirmada", items: baseIngredients },
                  { title: "Recheio confirmado", items: fillingIngredients },
                ] as const
              ).map((group) => (
                <div className="space-y-2" key={group.title}>
                  <p className="text-sm font-semibold text-slate-900">
                    {group.title}
                  </p>
                  {group.items.length ? (
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <span
                          key={item.key}
                          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1.5 text-sm font-semibold text-slate-900 ${
                            item.pending
                              ? "border-amber-300 bg-amber-50"
                              : "border-emerald-200 bg-emerald-50"
                          }`}
                        >
                          <span className="truncate">{item.name}</span>
                          {item.pending ? (
                            <span className="text-[10px] font-bold uppercase text-amber-700">
                              Pendente
                            </span>
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Remover ${item.name}`}
                            title={`Remover ${item.name}`}
                            onClick={() =>
                              setConfirmed((rows) =>
                                rows.filter((row) => row.key !== item.key)
                              )
                            }
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-black/5 hover:text-slate-900"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                      Nenhum ingrediente confirmado.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <fieldset>
            <legend className="text-sm font-semibold text-slate-900">
              Tamanhos
            </legend>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {PIZZA_SIZE_OPTIONS.map((option) => {
                const checked = variationCodes.includes(option.code);
                return (
                  <label
                    key={option.code}
                    title={option.fullLabel}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                      checked
                        ? "border-violet-300 bg-violet-50 text-violet-950"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setVariationCodes((current) =>
                          event.target.checked
                            ? [...current, option.code]
                            : current.filter((code) => code !== option.code)
                        )
                      }
                      className="h-4 w-4 accent-violet-700"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                className="text-sm font-semibold text-slate-900"
                htmlFor="pizza-flavor-name"
              >
                Nome do sabor{" "}
                <span className="font-normal text-slate-500">
                  (opcional agora)
                </span>
              </label>
              {nameSuggestions.length ? (
                <span className="text-xs text-slate-500">
                  Sugestões baseadas no recheio
                </span>
              ) : null}
            </div>
            <input
              id="pizza-flavor-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pode deixar em branco e definir depois"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-slate-900"
            />
            {nameSuggestions.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {nameSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setName(suggestion)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            {!name.trim() ? (
              <p className="mt-2 text-xs text-slate-500">
                Será salvo com um nome interno de rascunho.
              </p>
            ) : null}
          </div>

          <p className="text-[11px] text-slate-500">
            Cada ingrediente recebe, por tamanho, a média usada nos sabores
            visíveis do canal cardápio. Sem histórico compatível, começa em zero
            para revisão.
          </p>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {!loaderData?.payload?.ready ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {loaderData?.payload?.setupMessage ||
                "Configuração necessária não encontrada."}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={
              !baseIngredients.length ||
              !fillingIngredients.length ||
              !variationCodes.length ||
              !loaderData?.payload?.ready ||
              navigation.state !== "idle"
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChefHat className="h-5 w-5" />
            {navigation.state === "submitting"
              ? "Criando sabor..."
              : "Criar sabor, receita e ficha"}
          </button>
        </Form>
      </div>
    </section>
  );
}
