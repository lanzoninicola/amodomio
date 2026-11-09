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
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import createUUID from "~/utils/uuid";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const itemId = String(url.searchParams.get("itemId") || "").trim();

    const db = prismaClient as any;
    const items = await db.item.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        classification: true,
        ItemVariation: {
          where: { deletedAt: null },
          select: {
            id: true,
            variationId: true,
            isReference: true,
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
    });

    const itemCatalog = items.map((item: any) => {
      const itemVariations = (item.ItemVariation || []).map((v: any) => ({
        id: v.id,
        variationId: v.variationId,
        isReference: Boolean(v.isReference),
        variationName: v.Variation?.name || v.Variation?.code || "Variação",
        variationCode: v.Variation?.code || "",
        variationKind: v.Variation?.kind || "",
      }));
      const primaryVariation =
        itemVariations.find((variation: any) => variation.isReference && variation.variationKind !== "base") ||
        itemVariations.find((variation: any) => variation.variationKind !== "base") ||
        itemVariations.find((variation: any) => variation.variationKind === "base" || variation.variationCode === "base") ||
        itemVariations[0] ||
        null;

      return {
        id: item.id,
        name: item.name,
        classification: item.classification || "",
        itemVariations,
        primaryVariation,
      };
    });

    const selectedItem = itemId ? itemCatalog.find((item: any) => item.id === itemId) || null : null;

    return ok({
      sourceItem: itemId ? (selectedItem ? { id: selectedItem.id, name: selectedItem.name } : null) : null,
      itemCatalog,
      defaultItemId: selectedItem?.id || "",
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
    if (_action !== "item-cost-sheet-create") {
      return badRequest("Ação inválida");
    }

    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!name) return badRequest("Informe o nome da ficha de custo");

    const db = prismaClient as any;
    const itemVariations = await itemVariationPrismaEntity.findManyByItemId(itemId);
    const primaryVariation = await itemVariationPrismaEntity.findPrimaryVariationForItem(itemId, { ensureBaseIfMissing: true });
    const targetVariations = itemVariations.length > 0 ? itemVariations : primaryVariation ? [primaryVariation] : [];

    if (targetVariations.length === 0) {
      return badRequest("Nenhuma variação disponível para criar a ficha");
    }

    const primaryTargetVariation =
      targetVariations.find((variation: any) => variation.id === primaryVariation?.id) ||
      targetVariations[0];

    const latestVersions = await db.itemCostSheet.findMany({
      where: { itemId, itemVariationId: { in: targetVariations.map((variation: any) => variation.id) } },
      select: { version: true },
      orderBy: [{ version: "desc" }],
    });
    const nextVersion = Number(
      latestVersions.reduce((max: number, row: any) => Math.max(max, Number(row?.version || 0)), 0) + 1
    );

    const rootSheetId = createUUID();
    const orderedVariations = [
      primaryTargetVariation,
      ...targetVariations.filter((variation: any) => variation.id !== primaryTargetVariation?.id),
    ].filter(Boolean);

    for (const itemVariation of orderedVariations) {
      const isRoot = itemVariation.id === primaryTargetVariation.id;
      await db.itemCostSheet.create({
        data: {
          id: isRoot ? rootSheetId : createUUID(),
          itemId,
          itemVariationId: itemVariation.id,
          name,
          description: description || null,
          version: nextVersion,
          status: "draft",
          isActive: false,
          baseItemCostSheetId: isRoot ? null : rootSheetId,
        },
      });
    }

    return redirect(`/admin/item-cost-sheets/${rootSheetId}`);
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
    classification: string;
    itemVariations: Array<{
      id: string;
      variationId: string;
      isReference: boolean;
      variationName: string;
      variationCode: string;
      variationKind: string;
    }>;
    primaryVariation: {
      id: string;
      variationId: string;
      isReference: boolean;
      variationName: string;
      variationCode: string;
      variationKind: string;
    } | null;
  }>;
  const defaultItemId = String(payload.defaultItemId || "");
  const [itemComboboxOpen, setItemComboboxOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(defaultItemId);

  const selectedCatalogItem = useMemo(
    () => itemCatalog.find((item) => item.id === selectedItemId) || null,
    [itemCatalog, selectedItemId]
  );
  const primaryVariation = selectedCatalogItem?.primaryVariation || null;
  const selectedItemVariations = selectedCatalogItem?.itemVariations || [];
  const suggestedName = useMemo(() => {
    const itemName = selectedCatalogItem?.name?.trim();
    if (!itemName) return "";
    return `Ficha tecnica ${itemName}`;
  }, [selectedCatalogItem?.name]);
  const [nameValue, setNameValue] = useState(suggestedName);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!nameTouched) {
      setNameValue(suggestedName);
    }
  }, [nameTouched, suggestedName]);

  return (
    <div className="bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Nova ficha de custo</h2>
      <p className="mt-2 text-sm text-slate-500">
        Gerencia a fichas de custo dos itens.
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
        <Form method="post" className="mt-4 space-y-12">
          <input type="hidden" name="itemId" value={selectedItemId} />

          <div className="grid grid-cols-2 gap-6">

            <div className="flex flex-col space-y-6">
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
                      <span className="min-w-0 text-left">
                        {selectedCatalogItem ? (
                          <span className="block min-w-0">
                            <span className="block truncate">{selectedCatalogItem.name}</span>
                            {selectedCatalogItem.classification ? (
                              <span className="block truncate text-xs text-slate-500">
                                {selectedCatalogItem.classification}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "Selecione o item"
                        )}
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
                                "mr-2 h-4 w-4 shrink-0",
                                selectedItemId === item.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="min-w-0">
                              <div className="truncate">{item.name}</div>
                              {item.classification ? (
                                <div className="truncate text-xs text-slate-500">{item.classification}</div>
                              ) : null}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                  placeholder="Ex.: Ficha tecnica Mortazza"
                  required
                />
                {!nameTouched && suggestedName ? (
                  <p className="mt-2 text-xs text-slate-500">
                    O nome será compartilhado pela ficha do item. Os tamanhos ficam dentro do mesmo grupo.
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" name="description" placeholder="Opcional" />
              </div>

            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tamanhos vinculados</p>
              {selectedCatalogItem ? (
                <>
                  <p className="mt-1 text-sm text-slate-900">
                    Ao criar a ficha deste item, o sistema gera uma ficha para cada tamanho vinculado a ele.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedCatalogItem.itemVariations.length
                      ? `${selectedCatalogItem.itemVariations.length} tamanho(s) vinculado(s) ao item receberão ficha.`
                      : `Este item será criado com a variação padrão ${primaryVariation?.variationName || "Base"}.`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(selectedItemVariations.length > 0 ? selectedItemVariations : primaryVariation ? [primaryVariation] : []).map((variation) => (
                      <span
                        key={variation.id}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${variation.id === primaryVariation?.id ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
                      >
                        {variation.variationName}
                        {variation.id === primaryVariation?.id ? " · principal" : ""}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-900">
                    Selecione um item para visualizar os tamanhos vinculados que receberão ficha.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Os tamanhos dependem do item escolhido e só são carregados depois da seleção.
                  </p>
                </>
              )}
            </div>







          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="_action"
              value="item-cost-sheet-create"
              className="rounded-lg"
              disabled={!selectedItemId}
            >
              Criar fichas dos tamanhos
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
