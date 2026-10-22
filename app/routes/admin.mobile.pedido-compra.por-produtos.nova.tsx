import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import {
  Await,
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Check, Minus, Plus, Search, ShoppingBasket } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import {
  createMobilePurchaseList,
  listMobilePurchaseCatalog,
} from "~/domain/purchase/purchase-shopping-list.server";

export async function loader(_: LoaderFunctionArgs) {
  return defer({ catalog: listMobilePurchaseCatalog() });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const itemIds = form.getAll("itemId").map(String);
  const quantities = form.getAll("quantity").map(String);
  const units = form.getAll("unit").map(String);
  const items = itemIds
    .map((itemId, index) => ({
      itemId,
      quantity: Number(quantities[index]?.replace(",", ".")),
      unit: String(units[index] || "").trim(),
    }))
    .filter(
      (item) =>
        item.itemId &&
        item.unit &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    );

  if (!name || items.length === 0) {
    return json(
      { error: "Informe o nome e selecione ao menos um produto válido." },
      { status: 400 }
    );
  }

  if (items.length !== itemIds.length)
    return json(
      { error: "Revise as quantidades e unidades dos produtos." },
      { status: 400 }
    );
  let list;
  try {
    list = await createMobilePurchaseList(name, items);
  } catch {
    return json(
      {
        error:
          "Não foi possível criar a lista. Revise os produtos e tente novamente.",
      },
      { status: 400 }
    );
  }
  return redirect(`/admin/mobile/pedido-compra/por-produtos/${list.id}`);
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type CatalogItem = {
  suppliers: { id: string; name: string }[];
  id: string;
  name: string;
  unitOptions: string[];
  defaultUnit: string;
};

type Selection = Record<string, { quantity: string; unit: string }>;

export default function AdminMobilePedidoCompraPorProdutosNova() {
  const { catalog } = useLoaderData<typeof loader>();

  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
      }
    >
      <Await resolve={catalog}>
        {(resolvedCatalog) => (
          <NewPurchaseListForm catalog={resolvedCatalog as CatalogItem[]} />
        )}
      </Await>
    </Suspense>
  );
}

function NewPurchaseListForm({ catalog }: { catalog: CatalogItem[] }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [supplierId, setSupplierId] = useState("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const suppliers = Array.from(
    new Map(
      catalog
        .flatMap((item) => item.suppliers)
        .map((supplier) => [supplier.id, supplier])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>({});

  const visibleCatalog = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return catalog.filter(
      (item) =>
        normalizeSearch(item.name).includes(normalizedQuery) &&
        (supplierId === "all" ||
          (supplierId === "none"
            ? !item.suppliers.length
            : item.suppliers.some((supplier) => supplier.id === supplierId))) &&
        (!selectedOnly || selection[item.id])
    );
  }, [catalog, query, supplierId, selectedOnly, selection]);

  function toggleItem(item: CatalogItem) {
    setSelection((current) => {
      if (current[item.id]) {
        const next = { ...current };
        delete next[item.id];
        return next;
      }
      return {
        ...current,
        [item.id]: { quantity: "1", unit: item.defaultUnit },
      };
    });
  }

  function updateItem(
    itemId: string,
    patch: Partial<{ quantity: string; unit: string }>
  ) {
    setSelection((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...patch },
    }));
  }

  function changeQuantity(itemId: string, delta: number) {
    const value = Number(
      String(selection[itemId]?.quantity || "0").replace(",", ".")
    );
    updateItem(itemId, {
      quantity: String(
        Math.max(1, (Number.isFinite(value) ? value : 0) + delta)
      ),
    });
  }

  return (
    <Form method="post" className="space-y-4 pb-8">
      <label className="block">
        <span className="text-sm font-semibold text-slate-900">
          Nome da lista
        </span>
        <input
          name="name"
          required
          defaultValue={`Compras ${new Date().toLocaleDateString("pt-BR")}`}
          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold outline-none focus:border-slate-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-900">Produtos</span>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: bebidas"
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-900"
          />
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Search className="h-4 w-4" />
          </span>
        </div>
      </label>

      <Select value={supplierId} onValueChange={setSupplierId}>
        <SelectTrigger aria-label="Filtrar por fornecedor">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os fornecedores</SelectItem>
          <SelectItem value="none">Sem fornecedor no histórico</SelectItem>
          {suppliers.map((supplier) => (
            <SelectItem key={supplier.id} value={supplier.id}>
              {supplier.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-slate-500">
        Fornecedores identificados nas entradas de estoque. O filtro não altera
        os produtos selecionados.
      </p>
      <button
        type="button"
        className="text-sm underline"
        onClick={() => setSelectedOnly((value) => !value)}
      >
        {selectedOnly
          ? "Mostrar todos"
          : `Revisar selecionados (${Object.keys(selection).length})`}
      </button>
      {Object.entries(selection).map(([id, value]) => (
        <span key={id}>
          <input type="hidden" name="itemId" value={id} />
          <input type="hidden" name="quantity" value={value.quantity} />
          <input type="hidden" name="unit" value={value.unit} />
        </span>
      ))}
      {!visibleCatalog.length ? <p>Nenhum produto encontrado.</p> : null}
      {actionData?.error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {actionData.error}
        </p>
      ) : null}

      <div className="space-y-2">
        {visibleCatalog.map((item) => {
          const selected = selection[item.id];
          return (
            <article
              key={item.id}
              className={`rounded-xl border bg-white p-3 ${
                selected ? "border-blue-500 bg-blue-50" : "border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-sm font-semibold text-slate-900">
                  {item.name}
                </span>
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {selected ? <Check className="h-5 w-5" /> : null}
                </span>
              </button>

              {selected ? (
                <div className="mt-3 grid grid-cols-[104px_minmax(0,1fr)] gap-2 border-t border-blue-200 pt-3">
                  <Select
                    value={selected.unit}
                    onValueChange={(unit) => updateItem(item.id, { unit })}
                  >
                    <SelectTrigger aria-label={`Unidade de ${item.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {item.unitOptions.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex h-12 min-w-0 items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
                    <input
                      aria-label={`Quantidade de ${item.name}`}
                      value={selected.quantity}
                      onChange={(event) =>
                        updateItem(item.id, { quantity: event.target.value })
                      }
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent px-3 text-center text-base font-semibold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => changeQuantity(item.id, -1)}
                      className="flex h-full w-11 items-center justify-center border-l border-red-200 bg-red-50 text-red-700"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeQuantity(item.id, 1)}
                      className="flex h-full w-11 items-center justify-center border-l border-green-200 bg-green-50 text-green-700"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {Object.keys(selection).length > 0 ? (
        <div className="sticky bottom-4 z-10">
          <button
            type="submit"
            disabled={navigation.state !== "idle"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          >
            <ShoppingBasket className="h-5 w-5" />
            {navigation.state !== "idle"
              ? "Criando lista..."
              : `Criar lista (${Object.keys(selection).length})`}
          </button>
        </div>
      ) : null}
    </Form>
  );
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
