import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useOutletContext,
} from "@remix-run/react";
import { Copy, MessageCircle, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { AdminItemVendaOutletContext } from "./admin.items.$id.venda";
import { toast } from "~/components/ui/use-toast";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import { buildUniqueItemSellingSlug } from "~/domain/item/item-selling-slug.server";
import prismaClient from "~/lib/prisma/client.server";
import { slugifyString } from "~/utils/slugify";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta = buildAdminItemsMeta("Venda comercial");

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function buildCardapioWhatsappMessage(params: {
  itemName: string;
  baseIngredients: string | null;
  ingredients: string | null;
  priceLines: string[];
}) {
  const baseIngredientsText =
    params.baseIngredients?.trim() || "base ainda nao preenchida";
  const ingredientsText =
    params.ingredients?.trim() || "ingredientes do sabor ainda nao preenchidos";
  const priceText =
    params.priceLines.length > 0
      ? params.priceLines.join("\n")
      : "- sem precos cadastrados no cardapio";

  return [
    "Oi! Por favor, adicionar o novo sabor no cardapio:",
    "",
    `*Nome*: ${params.itemName}`,
    `*Base*: ${baseIngredientsText}`,
    `*Ingredientes do sabor*: ${ingredientsText}`,
    "",
    "Precos de venda por tamanho:",
    priceText,
  ].join("\n");
}

function buildLongDescriptionChatGptPrompt(params: {
  itemName: string;
  baseIngredients: string;
  ingredients: string;
  currentDescription: string;
}) {
  const currentDescription = params.currentDescription.trim();
  const task = currentDescription
    ? "Revise e melhore a descricao extensa atual"
    : "Crie uma descricao extensa";

  return [
    `${task} para este sabor do cardapio da pizzaria Amodomio.`,
    "",
    `Nome do sabor: ${params.itemName}`,
    `Base da pizza: ${params.baseIngredients.trim() || "nao informada"}`,
    `Ingredientes do sabor: ${params.ingredients.trim() || "nao informados"}`,
    ...(currentDescription ? ["", "Descricao atual:", currentDescription] : []),
    "",
    "Escreva em portugues do Brasil, com tom comercial, apetitoso e natural.",
    "Destaque a experiencia do sabor e os ingredientes informados, sem inventar ingredientes, caracteristicas ou promessas.",
    "Entregue um unico paragrafo, sem titulo, lista, aspas, emojis ou explicacoes adicionais, pronto para colar no campo de descricao extensa.",
  ].join("\n");
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const [item, productLines, groups, categories] = await Promise.all([
      (prismaClient as any).item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          name: true,
          ItemSellingInfo: {
            select: {
              id: true,
              baseIngredients: true,
              ingredients: true,
              longDescription: true,
              categoryId: true,
              itemGroupId: true,
              notesPublic: true,
              slug: true,
            },
          },
          Recipe: {
            select: {
              id: true,
              name: true,
              RecipeIngredient: {
                select: {
                  sortOrderIndex: true,
                  IngredientItem: { select: { name: true } },
                },
                orderBy: { sortOrderIndex: "asc" },
              },
            },
            take: 1,
          },
        },
      }),
      prismaClient.productLine.findMany({
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: { id: true, key: true, name: true, active: true },
      }),
      prismaClient.itemGroup.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: {
          id: true,
          key: true,
          name: true,
          productLineId: true,
        },
      }),
      prismaClient.category.findMany({
        where: { type: "menu" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!item) return badRequest("Item não encontrado");

    return ok({
      item,
      productLines,
      categories,
      groups,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "");

    if (actionName !== "update-commercial-info") {
      return badRequest("Ação inválida");
    }

    const ingredients = String(formData.get("ingredients") || "").trim();
    const baseIngredients = String(
      formData.get("baseIngredients") || ""
    ).trim();
    const longDescriptionRaw = String(
      formData.get("longDescription") || ""
    ).trim();
    const notesPublicRaw = String(formData.get("notesPublic") || "").trim();
    const slugRaw = String(formData.get("slug") || "").trim();
    const categoryId = String(formData.get("categoryId") || "").trim();
    const productLineId = String(formData.get("productLineId") || "").trim();
    const itemGroupIdRaw = String(formData.get("itemGroupId") || "").trim();
    const requestedSlug = slugRaw ? slugifyString(slugRaw) : null;

    if (!categoryId) {
      return badRequest("Categoria inválida");
    }

    if (!productLineId) {
      return badRequest("Linha de produto é obrigatória");
    }

    if (!itemGroupIdRaw) {
      return badRequest("Grupo é obrigatório");
    }

    const item = await (prismaClient as any).item.findUnique({
      where: { id: itemId },
      select: { id: true, name: true },
    });

    if (!item) {
      return badRequest("Item não encontrado");
    }

    const slug =
      requestedSlug ||
      (await buildUniqueItemSellingSlug(prismaClient as any, item.name, {
        itemId,
      }));

    if (requestedSlug) {
      const slugConflict = await (
        prismaClient as any
      ).itemSellingInfo.findFirst({
        where: {
          slug: requestedSlug,
          itemId: { not: itemId },
        },
        select: { itemId: true },
      });

      if (slugConflict) {
        return badRequest("Slug já está em uso por outro item.");
      }
    }

    const [category, productLine, group] = await Promise.all([
      prismaClient.category.findFirst({
        where: {
          id: categoryId,
          type: "menu",
        },
        select: { id: true },
      }),
      prismaClient.productLine.findUnique({
        where: { id: productLineId },
        select: { id: true },
      }),
      itemGroupIdRaw
        ? prismaClient.itemGroup.findFirst({
            where: {
              id: itemGroupIdRaw,
              deletedAt: null,
            },
            select: { id: true, productLineId: true },
          })
        : Promise.resolve(null),
    ]);

    if (!category) {
      return badRequest("Categoria de cardápio não encontrada");
    }

    if (!productLine) {
      return badRequest("Linha de produto não encontrada");
    }

    if (itemGroupIdRaw && !group) {
      return badRequest("Grupo não encontrado");
    }

    if (group?.productLineId !== productLineId) {
      return badRequest("O grupo selecionado não pertence à linha de produto");
    }

    await (prismaClient as any).itemSellingInfo.upsert({
      where: { itemId },
      update: {
        baseIngredients: baseIngredients || null,
        ingredients: ingredients || null,
        longDescription: longDescriptionRaw || null,
        notesPublic: notesPublicRaw || null,
        slug,
        categoryId,
        itemGroupId: itemGroupIdRaw || null,
      },
      create: {
        itemId,
        baseIngredients: baseIngredients || null,
        ingredients: ingredients || null,
        longDescription: longDescriptionRaw || null,
        notesPublic: notesPublicRaw || null,
        slug,
        categoryId,
        itemGroupId: itemGroupIdRaw || null,
      },
    });

    return ok("Informações comerciais atualizadas.");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemVendaComercialRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { sellingMatrix } = useOutletContext<AdminItemVendaOutletContext>();
  const formRef = useRef<HTMLFormElement>(null);
  const payload = (loaderData?.payload || {}) as {
    item?: {
      id: string;
      name: string;
      ItemSellingInfo?: {
        id: string;
        baseIngredients: string | null;
        ingredients: string | null;
        longDescription: string | null;
        notesPublic: string | null;
        slug: string | null;
        categoryId: string | null;
        itemGroupId: string | null;
      } | null;
      Recipe?: Array<{
        id: string;
        name: string;
        RecipeIngredient: Array<{
          sortOrderIndex: number;
          IngredientItem: { name: string };
        }>;
      }>;
    } | null;
    categories?: Array<{
      id: string;
      name: string;
    }>;
    productLines?: Array<{
      id: string;
      key: string;
      name: string;
      active: boolean;
    }>;
    groups?: Array<{
      id: string;
      key: string;
      name: string;
      productLineId: string;
    }>;
  };

  const item = payload.item || null;
  const sellingInfo = item?.ItemSellingInfo || null;
  const generatedItemSlug = slugifyString(item?.name) || "";
  const linkedRecipe = item?.Recipe?.[0] || null;
  const recipeIngredientNames = (linkedRecipe?.RecipeIngredient || []).map(
    (ri) => ri.IngredientItem.name
  );
  const categories = payload.categories || [];
  const productLines = payload.productLines || [];
  const groups = payload.groups || [];
  const [categoryIdValue, setCategoryIdValue] = useState(
    sellingInfo?.categoryId || ""
  );
  const [groupIdValue, setGroupIdValue] = useState(
    sellingInfo?.itemGroupId || ""
  );
  const [productLineIdValue, setProductLineIdValue] = useState(
    groups.find((group) => group.id === sellingInfo?.itemGroupId)
      ?.productLineId || ""
  );
  const [baseIngredientsValue, setBaseIngredientsValue] = useState(
    sellingInfo?.baseIngredients || ""
  );
  const [ingredientsValue, setIngredientsValue] = useState(
    sellingInfo?.ingredients || ""
  );
  const [longDescriptionValue, setLongDescriptionValue] = useState(
    sellingInfo?.longDescription || ""
  );
  const [whatsappMessage, setWhatsappMessage] = useState("");

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }

    if (actionData?.status && actionData.status >= 400) {
      toast({
        title: "Erro",
        description: actionData.message,
        variant: "destructive",
      });
    }
  }, [actionData]);

  useEffect(() => {
    setCategoryIdValue(sellingInfo?.categoryId || "");
    setGroupIdValue(sellingInfo?.itemGroupId || "");
    setProductLineIdValue(
      groups.find((group) => group.id === sellingInfo?.itemGroupId)
        ?.productLineId || ""
    );
    setBaseIngredientsValue(sellingInfo?.baseIngredients || "");
    setIngredientsValue(sellingInfo?.ingredients || "");
    setLongDescriptionValue(sellingInfo?.longDescription || "");
  }, [
    sellingInfo?.baseIngredients,
    sellingInfo?.categoryId,
    sellingInfo?.ingredients,
    sellingInfo?.itemGroupId,
    sellingInfo?.longDescription,
    groups,
  ]);

  if (!item) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Item não encontrado</p>
      </section>
    );
  }

  const cardapioPriceLines = (sellingMatrix?.[0]?.variations || [])
    .map((variation) => {
      const cardapioPrice = variation.channels.cardapio?.[0];
      const priceAmount = Number(cardapioPrice?.priceAmount || 0);

      if (!cardapioPrice || priceAmount <= 0) return null;

      return `- *${variation.name}*: ${formatCurrency(priceAmount)}`;
    })
    .filter(Boolean) as string[];

  function generateWhatsappMessage() {
    setWhatsappMessage(
      buildCardapioWhatsappMessage({
        itemName: item.name,
        baseIngredients: baseIngredientsValue,
        ingredients: ingredientsValue,
        priceLines: cardapioPriceLines,
      })
    );
  }

  function copyWhatsappMessage() {
    if (!navigator?.clipboard) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar a mensagem.",
        variant: "destructive",
      });
      return;
    }

    void navigator.clipboard.writeText(whatsappMessage).then(() => {
      toast({
        title: "Mensagem copiada",
        description: "Cole a mensagem no WhatsApp.",
      });
    });
  }

  function copyCommercialJson() {
    if (!navigator?.clipboard || !formRef.current) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar os dados.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(formRef.current);
    const selectedCategory = categories.find(
      (category) => category.id === categoryIdValue
    );
    const selectedGroup = groups.find((group) => group.id === groupIdValue);
    const selectedProductLine = productLines.find(
      (line) => line.id === productLineIdValue
    );
    const commercialData = {
      item: {
        id: item.id,
        name: item.name,
      },
      baseIngredients: String(formData.get("baseIngredients") || ""),
      ingredients: String(formData.get("ingredients") || ""),
      longDescription: String(formData.get("longDescription") || ""),
      notesPublic: String(formData.get("notesPublic") || ""),
      slug: String(formData.get("slug") || ""),
      productLine: {
        id: productLineIdValue || null,
        name: selectedProductLine?.name || null,
      },
      category: {
        id: categoryIdValue || null,
        name: selectedCategory?.name || null,
      },
      group: {
        id: groupIdValue || null,
        name: selectedGroup?.name || null,
      },
    };

    void navigator.clipboard
      .writeText(JSON.stringify(commercialData, null, 2))
      .then(() => {
        toast({
          title: "JSON copiado",
          description: "Os dados comerciais foram copiados.",
        });
      })
      .catch(() => {
        toast({
          title: "Erro",
          description: "Não foi possível copiar os dados.",
          variant: "destructive",
        });
      });
  }

  function copyLongDescriptionChatGptPrompt() {
    if (!navigator?.clipboard) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o prompt.",
        variant: "destructive",
      });
      return;
    }

    const prompt = buildLongDescriptionChatGptPrompt({
      itemName: item.name,
      baseIngredients: baseIngredientsValue,
      ingredients: ingredientsValue,
      currentDescription: longDescriptionValue,
    });

    void navigator.clipboard
      .writeText(prompt)
      .then(() => {
        toast({
          title: "Prompt copiado",
          description: longDescriptionValue.trim()
            ? "Cole no ChatGPT para revisar a descrição atual."
            : "Cole no ChatGPT para criar a descrição extensa.",
        });
      })
      .catch(() => {
        toast({
          title: "Erro",
          description: "Não foi possível copiar o prompt.",
          variant: "destructive",
        });
      });
  }

  return (
    <Form ref={formRef} method="post" className="space-y-6">
      <input type="hidden" name="_action" value="update-commercial-info" />
      <input type="hidden" name="categoryId" value={categoryIdValue} />
      <input type="hidden" name="productLineId" value={productLineIdValue} />
      <input type="hidden" name="itemGroupId" value={groupIdValue} />

      <section className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={copyCommercialJson}
        >
          <Copy size={16} />
          Copiar JSON
        </Button>
        <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
          Salvar informações comerciais
        </Button>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Conteúdo</h3>
        </div>

        <Separator />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="baseIngredients">Base da pizza</Label>
            <Textarea
              id="baseIngredients"
              name="baseIngredients"
              value={baseIngredientsValue}
              onChange={(event) => setBaseIngredientsValue(event.target.value)}
              placeholder="Ex.: molho de tomate, muçarela..."
              className="min-h-32"
            />
            <p className="text-xs text-slate-500">
              Ingredientes fixos que entram na pizza antes do sabor.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ingredients">Ingredientes do sabor</Label>
              {recipeIngredientNames.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-slate-500 hover:text-slate-900"
                  onClick={() =>
                    setIngredientsValue(recipeIngredientNames.join(", "))
                  }
                >
                  <Wand2 size={13} />
                  Usar da receita
                </Button>
              )}
            </div>
            <Textarea
              id="ingredients"
              name="ingredients"
              value={ingredientsValue}
              onChange={(event) => setIngredientsValue(event.target.value)}
              placeholder="Ex.: manjericão, tomate cereja, parmesão..."
              className="min-h-32"
            />
            <p className="text-xs text-slate-500">
              Ingredientes que diferenciam este sabor da base padrão.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="longDescription">Descrição extensa</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-slate-500 hover:text-slate-900"
                onClick={copyLongDescriptionChatGptPrompt}
              >
                <Wand2 size={13} />
                {longDescriptionValue.trim()
                  ? "Revisar com ChatGPT"
                  : "Criar com ChatGPT"}
              </Button>
            </div>
            <Textarea
              id="longDescription"
              name="longDescription"
              value={longDescriptionValue}
              onChange={(event) => setLongDescriptionValue(event.target.value)}
              placeholder="Texto comercial mais completo para o canal."
              className="min-h-32"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Organização</h3>
        </div>

        <Separator />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="productLineIdSelect">
              Linha de produto <span className="text-red-500">*</span>
            </Label>
            <Select
              value={productLineIdValue}
              onValueChange={(nextProductLineId) => {
                setProductLineIdValue(nextProductLineId);
                if (
                  !groups.some(
                    (group) =>
                      group.id === groupIdValue &&
                      group.productLineId === nextProductLineId
                  )
                ) {
                  setGroupIdValue("");
                }
              }}
            >
              <SelectTrigger id="productLineIdSelect">
                <SelectValue placeholder="Selecionar linha..." />
              </SelectTrigger>
              <SelectContent>
                {productLines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                    {!line.active ? " (inativa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemGroupIdSelect">
              Grupo <span className="text-red-500">*</span>
            </Label>
            <Select value={groupIdValue} onValueChange={setGroupIdValue}>
              <SelectTrigger id="itemGroupIdSelect">
                <SelectValue placeholder="Selecionar grupo..." />
              </SelectTrigger>
              <SelectContent>
                {groups
                  .filter((group) => group.productLineId === productLineIdValue)
                  .map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryIdSelect">Categoria</Label>
            <Select value={categoryIdValue} onValueChange={setCategoryIdValue}>
              <SelectTrigger id="categoryIdSelect">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Publicação</h3>
        </div>

        <Separator />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug público <span className="text-red-500">*</span>
            </Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={sellingInfo?.slug || generatedItemSlug}
              placeholder={generatedItemSlug || "slug-publico"}
              required
            />
            <p className="text-xs text-slate-500">
              Gerado automaticamente pelo nome do item e usado na URL da pagina
              dos detalhes.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Observações</h3>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="notesPublic">Observações públicas</Label>
          <Textarea
            id="notesPublic"
            name="notesPublic"
            defaultValue={sellingInfo?.notesPublic || ""}
            placeholder="Informações adicionais visíveis para o cliente."
            className="min-h-28"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Mensagem para cardápio
            </h3>
            <p className="text-xs text-slate-500">
              Gera um texto para pedir a inclusão do sabor no cardápio pelo
              WhatsApp.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={generateWhatsappMessage}
          >
            <MessageCircle size={16} />
            Gerar mensagem WhatsApp
          </Button>
        </div>

        <Separator />

        {whatsappMessage ? (
          <div className="space-y-3">
            <Textarea
              value={whatsappMessage}
              onChange={(event) => setWhatsappMessage(event.target.value)}
              className="min-h-48 font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={copyWhatsappMessage}
            >
              <Copy size={16} />
              Copiar mensagem
            </Button>
          </div>
        ) : null}
      </section>
    </Form>
  );
}
