import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import createUUID from "~/utils/uuid";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const itemId = String(url.searchParams.get("itemId") || "").trim();
    const itemVariationIdFromQuery = String(
      url.searchParams.get("variationId") || url.searchParams.get("itemVariationId") || ""
    ).trim();

    const db = prismaClient as any;
    const [items, variations] = await Promise.all([
      db.item.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          ItemVariation: {
            where: { deletedAt: null },
            select: {
              id: true,
              variationId: true,
              Variation: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  kind: true,
                },
              },
            },
            orderBy: [{ createdAt: "asc" }],
            take: 50,
          },
        },
        orderBy: [{ name: "asc" }],
        take: 500,
      }),
      db.variation.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, code: true, kind: true },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        take: 1000,
      }),
    ]);

    const itemCatalog = items.map((item: any) => ({
      id: item.id,
      name: item.name,
      itemVariations: (item.ItemVariation || []).map((v: any) => ({
        id: v.id,
        variationId: v.variationId,
        variationName: v.Variation?.name || v.Variation?.code || "Variação",
        variationCode: v.Variation?.code || "",
        variationKind: v.Variation?.kind || "",
      })),
    }));

    const selectedItem =
      itemCatalog.find((item: any) => item.id === itemId) ||
      itemCatalog[0] ||
      null;
    const selectedVariationCatalog =
      variations.find((v: any) => v.id === itemVariationIdFromQuery) ||
      variations.find((v: any) => v.kind === "base" || v.code === "base") ||
      variations[0] ||
      null;

    return ok({
      sourceItem: itemId ? (selectedItem ? { id: selectedItem.id, name: selectedItem.name } : null) : null,
      itemCatalog,
      variationCatalog: variations.map((variation: any) => ({
        id: variation.id,
        name: variation.name,
        code: variation.code,
        kind: variation.kind,
      })),
      defaultItemId: selectedItem?.id || "",
      defaultVariationId: selectedVariationCatalog?.id || "",
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const url = new URL(request.url);
    const formData = await request.formData();
    const itemId = String(formData.get("itemId") || url.searchParams.get("itemId") || "").trim();
    if (!itemId) return badRequest("Item não informado");
    const _action = String(formData.get("_action") || "");
    if (_action !== "recipe-sheet-create") return badRequest("Ação inválida");

    const variationId = String(formData.get("variationId") || formData.get("itemVariationId") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!variationId) return badRequest("Informe a variação do item");
    if (!name) return badRequest("Informe o nome da ficha de custo");

    const db = prismaClient as any;
    const itemVariation = await itemVariationPrismaEntity.linkToItem({ itemId, variationId });

    const latest = await db.itemCostSheet.findFirst({
      where: { itemId, itemVariationId: itemVariation.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    await db.itemCostSheet.create({
      data: {
        id: createUUID(),
        itemId,
        itemVariationId: itemVariation.id,
        name,
        description: description || null,
        version: Number(latest?.version || 0) + 1,
        status: "draft",
        isActive: false,
      },
    });

    return redirect(`/admin/items/${itemId}/item-cost-sheets`);
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemCostSheetsNew() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const payload = loaderData?.payload || {};
  const sourceItem = payload.sourceItem as { id: string; name: string } | null;
  const itemCatalog = (payload.itemCatalog || []) as Array<{
    id: string;
    name: string;
    itemVariations: Array<{
      id: string;
      variationId: string;
      variationName: string;
      variationCode: string;
      variationKind: string;
    }>;
  }>;
  const variationCatalog = (payload.variationCatalog || []) as Array<{
    id: string;
    name: string;
    code: string;
    kind: string;
  }>;
  const defaultItemId = String(payload.defaultItemId || "");
  const defaultVariationId = String(payload.defaultVariationId || "");
  const [itemComboboxOpen, setItemComboboxOpen] = useState(false);
  const [variationComboboxOpen, setVariationComboboxOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(defaultItemId);
  const [selectedVariationId, setSelectedVariationId] = useState(defaultVariationId);

  const selectedCatalogItem = useMemo(
    () => itemCatalog.find((item) => item.id === selectedItemId) || null,
    [itemCatalog, selectedItemId]
  );
  const itemVariations = (selectedCatalogItem?.itemVariations || []) as Array<{
    id: string;
    variationId: string;
    variationName: string;
    variationCode: string;
    variationKind: string;
  }>;
  const selectedVariationCatalog = variationCatalog.find((variation) => variation.id === selectedVariationId) || null;
  const suggestedName = useMemo(() => {
    const itemName = selectedCatalogItem?.name?.trim();
    const variationName = selectedVariationCatalog?.name?.trim();
    if (!itemName) return "";
    if (!variationName) return `Ficha tecnica ${itemName}`;
    return `Ficha tecnica ${itemName} (${variationName})`;
  }, [selectedCatalogItem, selectedVariationCatalog]);
  const [nameValue, setNameValue] = useState(suggestedName);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!variationCatalog.length) {
      setSelectedVariationId("");
      return;
    }
    const stillExists = variationCatalog.some((v) => v.id === selectedVariationId);
    if (stillExists) return;

    const nextDefault =
      variationCatalog.find((v) => v.kind === "base" || v.code === "base")?.id ||
      variationCatalog[0]?.id ||
      "";
    setSelectedVariationId(nextDefault);
  }, [variationCatalog, selectedVariationId]);

  useEffect(() => {
    if (!nameTouched) {
      setNameValue(suggestedName);
    }
  }, [nameTouched, suggestedName]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Nova ficha de custo do item</h2>
      <p className="mt-2 text-sm text-slate-500">
        Você está na área correta para criar e gerenciar fichas de custo dos itens.
      </p>

      {sourceItem ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sabor corrente</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{sourceItem.name}</p>
        </div>
      ) : null}

      {actionData?.status >= 400 ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionData.message}
        </div>
      ) : null}

      {itemCatalog.length > 0 ? (
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="itemId" value={selectedItemId} />
          <input type="hidden" name="variationId" value={selectedVariationId} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="itemId">Item</Label>
              <Popover open={itemComboboxOpen} onOpenChange={setItemComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="itemId"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={itemComboboxOpen}
                    className="mt-1 w-full justify-between font-normal"
                  >
                    <span className="truncate text-left">
                      {selectedCatalogItem?.name || "Selecione o item"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar item..." />
                    <CommandList>
                      <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                      {itemCatalog.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.name} ${item.id}`}
                          onSelect={() => {
                            setSelectedItemId(item.id);
                            setItemComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedItemId === item.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{item.name}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="itemVariationId">Variação do item</Label>
              <Popover open={variationComboboxOpen} onOpenChange={setVariationComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="itemVariationId"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={variationComboboxOpen}
                    className="mt-1 w-full justify-between font-normal"
                  >
                    <span className="truncate text-left">
                      {selectedVariationCatalog
                        ? `${selectedVariationCatalog.name}${selectedVariationCatalog.kind ? ` (${selectedVariationCatalog.kind})` : ""}`
                        : "Selecione a variação"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar variação..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma variação encontrada.</CommandEmpty>
                      {variationCatalog.map((variation) => {
                        const linked = itemVariations.some((iv) => iv.variationId === variation.id);
                        return (
                          <CommandItem
                            key={variation.id}
                            value={`${variation.kind} ${variation.name} ${variation.code}`}
                            onSelect={() => {
                              setSelectedVariationId(variation.id);
                              setVariationComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedVariationId === variation.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{variation.name}</span>
                            <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                              {linked ? "vinculada" : "nova"}
                              {variation.kind}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="mt-2 text-xs text-slate-500">
                Se a variação ainda não estiver vinculada ao item, o vínculo `ItemVariation` será criado automaticamente ao salvar a ficha.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              value={nameValue}
              onChange={(event) => {
                setNameTouched(true);
                setNameValue(event.target.value);
              }}
              placeholder="Ex.: Ficha Campagnola (Base)"
              required
            />
            {!nameTouched && suggestedName ? (
              <p className="mt-2 text-xs text-slate-500">Sugestão automática baseada em item e variação.</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" placeholder="Opcional" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="_action"
              value="recipe-sheet-create"
              className="rounded-lg"
              disabled={!selectedVariationId}
            >
              Criar ficha
            </Button>
            {sourceItem ? (
              <Link to={`/admin/items/${sourceItem.id}/item-cost-sheets`}>
                <Button type="button" variant="outline" className="rounded-lg">Voltar ao item</Button>
              </Link>
            ) : (
              <Link to="/admin/item-cost-sheets">
                <Button type="button" variant="outline" className="rounded-lg">Voltar</Button>
              </Link>
            )}
          </div>
        </Form>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum item ativo disponível para criação de ficha de custo.
        </div>
      )}
    </div>
  );
}
