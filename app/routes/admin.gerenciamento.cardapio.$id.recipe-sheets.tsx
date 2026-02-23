import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import createUUID from "~/utils/uuid";

type RecipeSheetStatusType = "draft" | "active" | "archived";
type RecipeSheetLineType = "manual" | "product" | "recipe" | "recipeSheet" | "labor";
type RecipeSheetReferenceOption = { id: string; name: string; unit?: string | null };

function toNumber(value: FormDataEntryValue | null | undefined, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function calcLineTotal(quantity: number, unitCostAmount: number, wastePerc: number): number {
  const subtotal = quantity * unitCostAmount;
  return roundTo2(subtotal * (1 + wastePerc / 100));
}

function normalizeName(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function getEffectiveLineType(type: RecipeSheetLineType): Exclude<RecipeSheetLineType, "recipe"> {
  return type === "recipe" ? "recipeSheet" : type;
}

async function resolveRecipeSheetLineReference(
  tx: typeof prismaClient,
  type: RecipeSheetLineType,
  refId: string
) {
  if (!refId) return null;

  if (type === "product") {
    const product = await tx.product.findUnique({
      where: { id: refId },
      select: { id: true, name: true, um: true },
    });
    if (!product) {
      throw new Error("Produto selecionado não encontrado");
    }
    return {
      refId: product.id,
      name: product.name,
      unit: product.um ?? null,
    };
  }

  if (type === "recipeSheet") {
    const recipeSheet = await tx.recipeSheet.findUnique({
      where: { id: refId },
      include: {
        MenuItem: { select: { name: true } },
        MenuItemSize: { select: { name: true } },
      },
    });
    if (!recipeSheet) {
      throw new Error("Ficha técnica selecionada não encontrada");
    }
    if (!recipeSheet.isActive) {
      throw new Error("Selecione uma ficha técnica ativa");
    }

    const refName = `${recipeSheet.MenuItem?.name ?? "Item"} (${recipeSheet.MenuItemSize?.name ?? "Tamanho"})`;

    return {
      refId: recipeSheet.id,
      name: refName,
      unit: null,
    };
  }

  return null;
}

async function migrateLegacyRecipeLinesToRecipeSheet(
  tx: typeof prismaClient,
  menuItemId: string,
  menuItemSizeId: string
) {
  const legacyLines = await tx.recipeSheetLine.findMany({
    where: {
      type: "recipe",
      RecipeSheet: {
        menuItemId,
        menuItemSizeId,
      },
    },
    include: {
      RecipeSheet: true,
    },
  });

  if (legacyLines.length === 0) return;

  const referencedRecipeIds = Array.from(
    new Set(legacyLines.map((line) => line.refId).filter((id): id is string => Boolean(id)))
  );

  const [recipes, activeRecipeSheets] = await Promise.all([
    referencedRecipeIds.length > 0
      ? tx.recipe.findMany({
          where: { id: { in: referencedRecipeIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    tx.recipeSheet.findMany({
      where: { isActive: true },
      include: {
        MenuItem: { select: { name: true } },
        MenuItemSize: { select: { name: true, key: true } },
      },
    }),
  ]);

  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  for (const line of legacyLines) {
    const recipeName = normalizeName(recipesById.get(line.refId || "")?.name || line.name);

    if (!recipeName) continue;

    const candidates = activeRecipeSheets.filter((sheet) => {
      const sheetName = normalizeName(sheet.MenuItem?.name);
      return sheetName === recipeName;
    });

    if (candidates.length === 0) continue;

    let chosen = candidates[0];

    const mediumCandidates = candidates.filter(
      (sheet) => sheet.MenuItemSize?.key === "pizza-medium"
    );
    if (mediumCandidates.length === 1) {
      chosen = mediumCandidates[0];
    }

    if (chosen.id === line.recipeSheetId) continue;

    await tx.recipeSheetLine.update({
      where: { id: line.id },
      data: {
        type: "recipeSheet",
        refId: chosen.id,
        name: `${chosen.MenuItem?.name ?? "Item"} (${chosen.MenuItemSize?.name ?? "Tamanho"})`,
        unit: null,
        updatedAt: new Date(),
      },
    });
  }
}

async function recomputeRecipeSheetCost(tx: typeof prismaClient, recipeSheetId: string): Promise<number> {
  const lines = await tx.recipeSheetLine.findMany({
    where: { recipeSheetId },
    select: { totalCostAmount: true },
  });

  const costAmount = roundTo2(lines.reduce((acc, line) => acc + Number(line.totalCostAmount || 0), 0));

  await tx.recipeSheet.update({
    where: { id: recipeSheetId },
    data: { costAmount },
  });

  return costAmount;
}

async function syncMenuItemCostVariationFromRecipeSheet(
  tx: typeof prismaClient,
  recipeSheetId: string,
  updatedBy?: string
) {
  const recipeSheet = await tx.recipeSheet.findUnique({
    where: { id: recipeSheetId },
    select: {
      id: true,
      menuItemId: true,
      menuItemSizeId: true,
      costAmount: true,
    },
  });

  if (!recipeSheet) return;

  const existing = await tx.menuItemCostVariation.findUnique({
    where: {
      menuItemId_menuItemSizeId: {
        menuItemId: recipeSheet.menuItemId,
        menuItemSizeId: recipeSheet.menuItemSizeId,
      },
    },
  });

  await tx.menuItemCostVariation.upsert({
    where: {
      menuItemId_menuItemSizeId: {
        menuItemId: recipeSheet.menuItemId,
        menuItemSizeId: recipeSheet.menuItemSizeId,
      },
    },
    create: {
      id: createUUID(),
      menuItemId: recipeSheet.menuItemId,
      menuItemSizeId: recipeSheet.menuItemSizeId,
      costAmount: Number(recipeSheet.costAmount || 0),
      previousCostAmount: 0,
      updatedBy: updatedBy || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      previousCostAmount: existing?.costAmount ?? 0,
      costAmount: Number(recipeSheet.costAmount || 0),
      updatedBy: updatedBy || null,
      updatedAt: new Date(),
    },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const menuItemId = params.id;

  if (!menuItemId) {
    return badRequest("Item do cardápio não encontrado");
  }

  const url = new URL(request.url);
  const menuItemSizeIdFromQuery = url.searchParams.get("sizeId") || "";
  const recipeSheetIdFromQuery = url.searchParams.get("sheetId") || "";

  try {
    const [menuItem, sizes, productOptions, recipeSheetOptions] = await Promise.all([
      menuItemPrismaEntity.findById(menuItemId),
      prismaClient.menuItemSize.findMany({
        where: { visibleAdmin: true },
        orderBy: { sortOrderIndex: "asc" },
      }),
      prismaClient.product.findMany({
        select: { id: true, name: true, um: true },
        orderBy: { name: "asc" },
      }),
      prismaClient.recipeSheet.findMany({
        where: { isActive: true },
        include: {
          MenuItem: { select: { name: true } },
          MenuItemSize: { select: { name: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
    ]);

    if (!menuItem) {
      return badRequest("Item do cardápio não encontrado");
    }

    const selectedSize =
      sizes.find((size) => size.id === menuItemSizeIdFromQuery) || sizes[0] || null;

    if (!selectedSize) {
      return badRequest("Nenhum tamanho disponível para ficha técnica");
    }

    await prismaClient.$transaction((tx) =>
      migrateLegacyRecipeLinesToRecipeSheet(tx, menuItemId, selectedSize.id)
    );

    const recipeSheets = await prismaClient.recipeSheet.findMany({
      where: {
        menuItemId,
        menuItemSizeId: selectedSize.id,
      },
      include: {
        RecipeSheetLine: {
          orderBy: { sortOrderIndex: "asc" },
        },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });

    const selectedRecipeSheet =
      recipeSheets.find((sheet) => sheet.id === recipeSheetIdFromQuery) ||
      recipeSheets.find((sheet) => sheet.isActive) ||
      recipeSheets[0] ||
      null;

    return ok({
      menuItem,
      sizes,
      selectedSize,
      recipeSheets,
      selectedRecipeSheet,
      productOptions,
      recipeSheetOptions: recipeSheetOptions.map((sheet) => ({
        id: sheet.id,
        name: `${sheet.MenuItem?.name ?? "Item"} (${sheet.MenuItemSize?.name ?? "Tamanho"})`,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const menuItemId = params.id;

  if (!menuItemId) {
    return badRequest("Item do cardápio não encontrado");
  }

  const formData = await request.formData();
  const action = String(formData.get("_action") || "");

  const user = await authenticator.isAuthenticated(request);
  const updatedBy = user?.email || null;

  try {
    if (action === "recipe-sheet-create") {
      const menuItemSizeId = String(formData.get("menuItemSizeId") || "");
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();

      if (!menuItemSizeId) return badRequest("Informe o tamanho da ficha técnica");
      if (!name) return badRequest("Informe o nome da ficha técnica");

      const latest = await prismaClient.recipeSheet.findFirst({
        where: { menuItemId, menuItemSizeId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const created = await prismaClient.recipeSheet.create({
        data: {
          id: createUUID(),
          menuItemId,
          menuItemSizeId,
          name,
          description: description || null,
          version: (latest?.version ?? 0) + 1,
          status: "draft",
          createdBy: updatedBy,
          updatedBy,
        },
      });

      return ok({ message: "Ficha técnica criada com sucesso", payload: { recipeSheetId: created.id } });
    }

    if (action === "recipe-sheet-activate") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "");
      const menuItemSizeId = String(formData.get("menuItemSizeId") || "");

      if (!recipeSheetId || !menuItemSizeId) return badRequest("Ficha técnica inválida");

      await prismaClient.$transaction(async (tx) => {
        await tx.recipeSheet.updateMany({
          where: { menuItemId, menuItemSizeId, isActive: true },
          data: { isActive: false, status: "archived", updatedBy },
        });

        await recomputeRecipeSheetCost(tx, recipeSheetId);

        await tx.recipeSheet.update({
          where: { id: recipeSheetId },
          data: {
            isActive: true,
            status: "active",
            activatedAt: new Date(),
            updatedBy,
          },
        });

        await syncMenuItemCostVariationFromRecipeSheet(tx, recipeSheetId, updatedBy || undefined);
      });

      return ok("Ficha técnica ativada e custo sincronizado");
    }

    if (action === "recipe-sheet-delete") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "");
      if (!recipeSheetId) return badRequest("Ficha técnica inválida");

      const recipeSheet = await prismaClient.recipeSheet.findUnique({
        where: { id: recipeSheetId },
        select: { isActive: true },
      });

      if (!recipeSheet) return badRequest("Ficha técnica não encontrada");
      if (recipeSheet.isActive) {
        return badRequest("Não é possível excluir uma ficha técnica ativa");
      }

      await prismaClient.recipeSheet.delete({ where: { id: recipeSheetId } });
      return ok("Ficha técnica removida com sucesso");
    }

    if (action === "recipe-sheet-line-create") {
      const recipeSheetId = String(formData.get("recipeSheetId") || "");
      const typeRaw = String(formData.get("type") || "manual") as RecipeSheetLineType;
      const type = getEffectiveLineType(typeRaw);
      const refId = String(formData.get("refId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unit = String(formData.get("unit") || "").trim();
      const quantity = toNumber(formData.get("quantity"), 0);
      const unitCostAmount = toNumber(formData.get("unitCostAmount"), 0);
      const wastePerc = toNumber(formData.get("wastePerc"), 0);
      const notes = String(formData.get("notes") || "").trim();

      if (!recipeSheetId) return badRequest("Ficha técnica inválida");

      await prismaClient.$transaction(async (tx) => {
        const shouldResolveReference = type === "product" || type === "recipeSheet";
        if (shouldResolveReference && !refId) {
          throw new Error(type === "product" ? "Selecione um produto" : "Selecione uma ficha técnica");
        }
        const reference = shouldResolveReference
          ? await resolveRecipeSheetLineReference(tx, type, refId)
          : null;

        const nextName = (name || reference?.name || "").trim();
        const nextUnit = (unit || reference?.unit || "").trim();

        if (!nextName) {
          throw new Error("Informe o nome da linha");
        }

        const maxSort = await tx.recipeSheetLine.findFirst({
          where: { recipeSheetId },
          orderBy: { sortOrderIndex: "desc" },
          select: { sortOrderIndex: true },
        });

        await tx.recipeSheetLine.create({
          data: {
            id: createUUID(),
            recipeSheetId,
            type,
            refId: shouldResolveReference ? reference?.refId || null : null,
            name: nextName,
            unit: nextUnit || null,
            quantity,
            unitCostAmount,
            wastePerc,
            totalCostAmount: calcLineTotal(quantity, unitCostAmount, wastePerc),
            sortOrderIndex: (maxSort?.sortOrderIndex ?? 0) + 1,
            notes: notes || null,
          },
        });

        await recomputeRecipeSheetCost(tx, recipeSheetId);

        const recipeSheet = await tx.recipeSheet.findUnique({
          where: { id: recipeSheetId },
          select: { isActive: true },
        });
        if (recipeSheet?.isActive) {
          await syncMenuItemCostVariationFromRecipeSheet(tx, recipeSheetId, updatedBy || undefined);
        }
      });

      return ok("Linha adicionada com sucesso");
    }

    if (action === "recipe-sheet-line-update") {
      const recipeSheetLineId = String(formData.get("recipeSheetLineId") || "");
      const recipeSheetId = String(formData.get("recipeSheetId") || "");
      const typeRaw = String(formData.get("type") || "manual") as RecipeSheetLineType;
      const type = getEffectiveLineType(typeRaw);
      const refId = String(formData.get("refId") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const unit = String(formData.get("unit") || "").trim();
      const quantity = toNumber(formData.get("quantity"), 0);
      const unitCostAmount = toNumber(formData.get("unitCostAmount"), 0);
      const wastePerc = toNumber(formData.get("wastePerc"), 0);
      const notes = String(formData.get("notes") || "").trim();

      if (!recipeSheetLineId || !recipeSheetId) return badRequest("Linha inválida");

      await prismaClient.$transaction(async (tx) => {
        const shouldResolveReference = type === "product" || type === "recipeSheet";
        if (shouldResolveReference && !refId) {
          throw new Error(type === "product" ? "Selecione um produto" : "Selecione uma ficha técnica");
        }
        const reference = shouldResolveReference
          ? await resolveRecipeSheetLineReference(tx, type, refId)
          : null;

        const nextName = (name || reference?.name || "").trim();
        const nextUnit = (unit || reference?.unit || "").trim();

        if (!nextName) {
          throw new Error("Informe o nome da linha");
        }

        await tx.recipeSheetLine.update({
          where: { id: recipeSheetLineId },
          data: {
            type,
            refId: shouldResolveReference ? reference?.refId || null : null,
            name: nextName,
            unit: nextUnit || null,
            quantity,
            unitCostAmount,
            wastePerc,
            totalCostAmount: calcLineTotal(quantity, unitCostAmount, wastePerc),
            notes: notes || null,
          },
        });

        await recomputeRecipeSheetCost(tx, recipeSheetId);

        const recipeSheet = await tx.recipeSheet.findUnique({
          where: { id: recipeSheetId },
          select: { isActive: true },
        });
        if (recipeSheet?.isActive) {
          await syncMenuItemCostVariationFromRecipeSheet(tx, recipeSheetId, updatedBy || undefined);
        }
      });

      return ok("Linha atualizada com sucesso");
    }

    if (action === "recipe-sheet-line-delete") {
      const recipeSheetLineId = String(formData.get("recipeSheetLineId") || "");
      const recipeSheetId = String(formData.get("recipeSheetId") || "");

      if (!recipeSheetLineId || !recipeSheetId) return badRequest("Linha inválida");

      await prismaClient.$transaction(async (tx) => {
        await tx.recipeSheetLine.delete({ where: { id: recipeSheetLineId } });
        await recomputeRecipeSheetCost(tx, recipeSheetId);

        const recipeSheet = await tx.recipeSheet.findUnique({
          where: { id: recipeSheetId },
          select: { isActive: true },
        });
        if (recipeSheet?.isActive) {
          await syncMenuItemCostVariationFromRecipeSheet(tx, recipeSheetId, updatedBy || undefined);
        }
      });

      return ok("Linha removida com sucesso");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

function getStatusLabel(status: RecipeSheetStatusType) {
  if (status === "active") return "Ativa";
  if (status === "archived") return "Arquivada";
  return "Rascunho";
}

export default function AdminCardapioRecipeSheets() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();

  const payload = loaderData?.payload;

  const menuItem = payload?.menuItem;
  const sizes = payload?.sizes || [];
  const selectedSize = payload?.selectedSize;
  const recipeSheets = payload?.recipeSheets || [];
  const selectedRecipeSheet = payload?.selectedRecipeSheet;
  const productOptions = (payload?.productOptions || []) as RecipeSheetReferenceOption[];
  const recipeSheetOptions = (payload?.recipeSheetOptions || []) as RecipeSheetReferenceOption[];
  const [selectedSizeId, setSelectedSizeId] = useState<string>(selectedSize?.id || "");
  const [createLineType, setCreateLineType] = useState<RecipeSheetLineType>("manual");
  const [createLineRefId, setCreateLineRefId] = useState<string>("");
  const [lineTypeById, setLineTypeById] = useState<Record<string, RecipeSheetLineType>>({});
  const [lineRefIdById, setLineRefIdById] = useState<Record<string, string>>({});
  const suggestedRecipeSheetName = `Ficha tecnica ${menuItem?.name || ""} (${selectedSize?.name || ""})`.trim();

  useEffect(() => {
    if (!actionData) return;

    if (actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
      return;
    }

    toast({ title: "Ok", description: actionData.message });
  }, [actionData]);

  if (!payload) {
    return <div className="text-sm text-muted-foreground">Não foi possível carregar as fichas técnicas.</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gestao de custo</p>
          <h2 className="text-xl font-black tracking-tight text-slate-900">Fichas Técnicas</h2>
          <p className="text-sm text-slate-600">
            Item: <span className="font-medium text-foreground">{menuItem?.name}</span>
          </p>
        </div>

        <Form method="get" className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-[280px]">
            <Label htmlFor="sizeId" className="text-xs uppercase tracking-wide text-slate-500">Tamanho</Label>
            <input type="hidden" name="sizeId" value={selectedSizeId} />
            <Select value={selectedSizeId} onValueChange={setSelectedSizeId}>
              <SelectTrigger id="sizeId" className="mt-1 border-slate-200">
                <SelectValue placeholder="Selecione um tamanho" />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((size: any) => (
                  <SelectItem key={size.id} value={size.id}>
                    {size.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {searchParams.get("sheetId") ? (
            <input type="hidden" name="sheetId" value={searchParams.get("sheetId") || ""} />
          ) : null}

          <Button type="submit" variant="outline" className="border-slate-300">Selecionar</Button>
        </Form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nova ficha</h3>

          <Form method="post" className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="_action" value="recipe-sheet-create" />
            <input type="hidden" name="menuItemSizeId" value={selectedSize?.id || ""} />

            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                key={`${menuItem?.id || "item"}-${selectedSize?.id || "size"}`}
                id="name"
                name="name"
                defaultValue={suggestedRecipeSheetName}
                placeholder="Ficha tecnica Nome do sabor (Tamanho)"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" name="description" placeholder="Opcional" />
            </div>

            <Button type="submit" className="bg-slate-900 hover:bg-slate-700">Criar ficha</Button>
          </Form>

          <div className="mt-6 flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fichas deste tamanho</h3>

            {recipeSheets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ficha criada para este tamanho.</p>
            ) : (
              recipeSheets.map((sheet: any) => {
                const selected = selectedRecipeSheet?.id === sheet.id;

                return (
                  <div
                    key={sheet.id}
                    className={`rounded-xl border p-3 transition ${selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{sheet.name}</p>
                        <p className="text-xs text-slate-500">
                          v{sheet.version} • {getStatusLabel(sheet.status)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Custo total: R$ {Number(sheet.costAmount || 0).toFixed(2)}
                        </p>
                      </div>

                      {sheet.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          Ativa
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        className="text-xs font-medium text-slate-700 underline"
                        to={`?sizeId=${selectedSize?.id || ""}&sheetId=${sheet.id}`}
                      >
                        Editar
                      </Link>

                      {!sheet.isActive ? (
                        <Form method="post">
                          <input type="hidden" name="_action" value="recipe-sheet-activate" />
                          <input type="hidden" name="recipeSheetId" value={sheet.id} />
                          <input type="hidden" name="menuItemSizeId" value={selectedSize?.id || ""} />
                          <button className="text-xs font-medium text-slate-700 underline" type="submit">
                            Ativar
                          </button>
                        </Form>
                      ) : null}

                      {!sheet.isActive ? (
                        <Form method="post">
                          <input type="hidden" name="_action" value="recipe-sheet-delete" />
                          <input type="hidden" name="recipeSheetId" value={sheet.id} />
                          <button className="text-xs font-medium text-red-600 underline" type="submit">
                            Excluir
                          </button>
                        </Form>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selectedRecipeSheet ? (
            <p className="text-sm text-muted-foreground">Selecione ou crie uma ficha técnica para editar os itens.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{selectedRecipeSheet.name}</h3>
                  <p className="text-sm text-slate-500">
                    Versão {selectedRecipeSheet.version} • {getStatusLabel(selectedRecipeSheet.status)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Custo total</p>
                  <p className="text-2xl font-black text-slate-900">R$ {Number(selectedRecipeSheet.costAmount || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nova linha</h4>
                <Form method="post" className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-12">
                  <input type="hidden" name="_action" value="recipe-sheet-line-create" />
                  <input type="hidden" name="recipeSheetId" value={selectedRecipeSheet.id} />
                  <input type="hidden" name="type" value={createLineType} />
                  <input
                    type="hidden"
                    name="refId"
                    value={createLineType === "product" || createLineType === "recipeSheet" ? createLineRefId : ""}
                  />

                  <Select
                    value={createLineType}
                    onValueChange={(value) => {
                      setCreateLineType(value as RecipeSheetLineType);
                      setCreateLineRefId("");
                    }}
                  >
                    <SelectTrigger className="h-10 border-slate-200 bg-white md:col-span-2">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="product">Produto</SelectItem>
                      <SelectItem value="recipeSheet">Ficha técnica</SelectItem>
                      <SelectItem value="labor">Mão de obra</SelectItem>
                    </SelectContent>
                  </Select>

                  {(createLineType === "product" || createLineType === "recipeSheet") ? (
                    <Select value={createLineRefId} onValueChange={setCreateLineRefId}>
                      <SelectTrigger className="h-10 border-slate-200 bg-white md:col-span-3">
                        <SelectValue placeholder={createLineType === "product" ? "Selecionar produto" : "Selecionar ficha técnica"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(createLineType === "product" ? productOptions : recipeSheetOptions).map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input name="name" placeholder="Ingrediente" className="bg-white md:col-span-3" required />
                  )}
                  <Input name="unit" placeholder="Un" className="bg-white md:col-span-1" />
                  <Input type="number" min="0" step="0.001" name="quantity" placeholder="Qtd" className="bg-white md:col-span-1" required />
                  <Input type="number" min="0" step="0.01" name="unitCostAmount" placeholder="Custo unit." className="bg-white md:col-span-2" required />
                  <Input type="number" min="0" step="0.01" name="wastePerc" placeholder="Perda %" className="bg-white md:col-span-1" defaultValue={0} />
                  <Input name="notes" placeholder="Observação" className="bg-white md:col-span-1" />
                  <Button type="submit" className="bg-slate-900 hover:bg-slate-700 md:col-span-1">+</Button>
                </Form>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {(selectedRecipeSheet.RecipeSheetLine || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma linha cadastrada.</p>
                ) : (
                  selectedRecipeSheet.RecipeSheetLine.map((line: any) => (
                    <Form key={line.id} method="post" className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 md:grid-cols-12">
                      {(() => {
                        const effectiveType = getEffectiveLineType(
                          (lineTypeById[line.id] ?? line.type) as RecipeSheetLineType
                        );
                        const effectiveRefId = lineRefIdById[line.id] ?? line.refId ?? "";
                        return (
                          <>
                      <input type="hidden" name="recipeSheetId" value={selectedRecipeSheet.id} />
                      <input type="hidden" name="recipeSheetLineId" value={line.id} />
                            <input type="hidden" name="type" value={effectiveType} />
                      <input
                        type="hidden"
                        name="refId"
                        value={
                                  effectiveType === "product" || effectiveType === "recipeSheet"
                            ? effectiveRefId
                            : ""
                        }
                      />

                      <Select
                              value={effectiveType}
                        onValueChange={(value) =>
                          {
                            setLineTypeById((current) => ({
                              ...current,
                              [line.id]: value as RecipeSheetLineType,
                            }));
                            setLineRefIdById((current) => ({
                              ...current,
                              [line.id]: "",
                            }));
                          }
                        }
                      >
                        <SelectTrigger className="h-9 border-slate-200 md:col-span-2">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="product">Produto</SelectItem>
                          <SelectItem value="recipeSheet">Ficha técnica</SelectItem>
                          <SelectItem value="labor">Mão de obra</SelectItem>
                        </SelectContent>
                      </Select>

                              {(effectiveType === "product" || effectiveType === "recipeSheet") ? (
                        <Select
                                  value={effectiveRefId}
                          onValueChange={(value) =>
                            setLineRefIdById((current) => ({
                              ...current,
                              [line.id]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 border-slate-200 md:col-span-3">
                            <SelectValue
                                      placeholder={effectiveType === "product" ? "Selecionar produto" : "Selecionar ficha técnica"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                                    {(effectiveType === "product" ? productOptions : recipeSheetOptions).map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input name="name" defaultValue={line.name} className="md:col-span-3" required />
                      )}
                      <Input name="unit" defaultValue={line.unit || ""} className="md:col-span-1" />
                      <Input type="number" min="0" step="0.001" name="quantity" defaultValue={line.quantity} className="md:col-span-1" required />
                      <Input type="number" min="0" step="0.01" name="unitCostAmount" defaultValue={line.unitCostAmount} className="md:col-span-1" required />
                      <Input type="number" min="0" step="0.01" name="wastePerc" defaultValue={line.wastePerc} className="md:col-span-1" />
                      <Input name="notes" defaultValue={line.notes || ""} className="md:col-span-1" />

                      <div className="text-right text-xs font-semibold text-slate-600 md:col-span-1">
                        R$ {Number(line.totalCostAmount || 0).toFixed(2)}
                      </div>

                      <div className="flex gap-2 md:col-span-1 md:justify-end">
                        <Button type="submit" name="_action" value="recipe-sheet-line-update" variant="outline" size="sm">
                          Salvar
                        </Button>
                        <Button type="submit" name="_action" value="recipe-sheet-line-delete" variant="destructive" size="sm">
                          X
                        </Button>
                      </div>
                          </>
                        );
                      })()}
                    </Form>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
