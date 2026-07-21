import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { ArrowLeft, Download, Save } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [
  { title: "Vendas | Informações comerciais dos sabores" },
];

type TextEditItem = {
  id: string;
  name: string;
  active: boolean;
  canSell: boolean;
  visible: boolean;
  groupName: string | null;
  categoryName: string | null;
  baseIngredients: string;
  ingredients: string;
  longDescription: string;
  notesPublic: string;
};

function normalizeChannelKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function toSafeFilenameSegment(value: string | null | undefined) {
  const normalized = String(value || "canal")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "canal";
}

async function loadChannelByKey(channelKey: string) {
  const db = prismaClient as any;
  return db.itemSellingChannel.findFirst({
    where: {
      key: { equals: channelKey, mode: "insensitive" },
    },
    select: {
      id: true,
      key: true,
      name: true,
    },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const shouldExportJson =
      String(url.searchParams.get("export") || "").toLowerCase() === "json";
    const requestedChannelKey = normalizeChannelKey(params.channel);
    const selectedChannel = await loadChannelByKey(requestedChannelKey);

    if (!selectedChannel) {
      const fallbackChannel = await db.itemSellingChannel.findFirst({
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: { key: true },
      });
      return redirect(
        `/admin/vendas/itens-vendidos/${normalizeChannelKey(
          fallbackChannel?.key || "cardapio"
        )}/textos`
      );
    }

    const items = await db.item.findMany({
      where: {
        ItemSellingChannelItem: {
          some: {
            itemSellingChannelId: selectedChannel.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        active: true,
        canSell: true,
        ItemSellingInfo: {
          select: {
            baseIngredients: true,
            ingredients: true,
            longDescription: true,
            notesPublic: true,
            Category: { select: { name: true } },
            ItemGroup: { select: { name: true } },
          },
        },
        ItemSellingChannelItem: {
          where: { itemSellingChannelId: selectedChannel.id },
          select: {
            visible: true,
            sortOrderIndex: true,
          },
          take: 1,
        },
      },
      orderBy: [{ name: "asc" }],
    });

    const rows: TextEditItem[] = (items || [])
      .map((item: any) => {
        const channelLink = item.ItemSellingChannelItem?.[0] || null;
        return {
          id: String(item.id),
          name: item.name || "Item sem nome",
          active: Boolean(item.active),
          canSell: Boolean(item.canSell),
          visible: channelLink?.visible === true,
          groupName: item.ItemSellingInfo?.ItemGroup?.name || null,
          categoryName: item.ItemSellingInfo?.Category?.name || null,
          baseIngredients: item.ItemSellingInfo?.baseIngredients || "",
          ingredients: item.ItemSellingInfo?.ingredients || "",
          longDescription: item.ItemSellingInfo?.longDescription || "",
          notesPublic: item.ItemSellingInfo?.notesPublic || "",
          sortOrderIndex: Number(channelLink?.sortOrderIndex || 0),
        };
      })
      .sort(
        (
          a: TextEditItem & { sortOrderIndex?: number },
          b: TextEditItem & { sortOrderIndex?: number }
        ) =>
          Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
          a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      )
      .map(
        ({
          sortOrderIndex: _sortOrderIndex,
          ...item
        }: TextEditItem & { sortOrderIndex?: number }) => item
      );

    const channel = {
      id: String(selectedChannel.id),
      key: normalizeChannelKey(selectedChannel.key),
      name: selectedChannel.name || String(selectedChannel.key).toUpperCase(),
    };

    if (shouldExportJson) {
      const payload = {
        generatedAt: new Date().toISOString(),
        purpose:
          "Analise IA das informacoes comerciais dos sabores cadastradas em ItemSellingInfo.",
        source: {
          route: `/admin/vendas/itens-vendidos/${channel.key}/textos`,
          model: "ItemSellingInfo",
          channel,
        },
        fields: {
          baseIngredients:
            "ItemSellingInfo.baseIngredients - base fixa da pizza.",
          ingredients:
            "ItemSellingInfo.ingredients - ingredientes publicos do sabor.",
          longDescription:
            "ItemSellingInfo.longDescription - descricao comercial extensa.",
          notesPublic:
            "ItemSellingInfo.notesPublic - observacoes publicas para o cliente.",
        },
        items: rows.map((item) => ({
          id: item.id,
          name: item.name,
          status: {
            active: item.active,
            canSell: item.canSell,
            visibleInChannel: item.visible,
          },
          organization: {
            groupName: item.groupName,
            categoryName: item.categoryName,
          },
          itemSellingInfo: {
            baseIngredients: item.baseIngredients || null,
            ingredients: item.ingredients || null,
            longDescription: item.longDescription || null,
            notesPublic: item.notesPublic || null,
          },
        })),
      };
      const filename = `informacoes-comerciais-${toSafeFilenameSegment(
        channel.key
      )}-${new Date().toISOString().slice(0, 10)}.json`;

      return new Response(JSON.stringify(payload, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return ok({
      channel: {
        id: channel.id,
        key: channel.key,
        name: channel.name,
      },
      items: rows,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const requestedChannelKey = normalizeChannelKey(params.channel);
    const selectedChannel = await loadChannelByKey(requestedChannelKey);

    if (!selectedChannel) return badRequest("Canal de venda inválido.");

    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "").trim();

    if (actionName !== "update-selling-texts") {
      return badRequest("Ação inválida.");
    }

    const rowItemId = String(formData.get("rowItemId") || "").trim();
    const submittedItemIds = Array.from(
      new Set(formData.getAll("itemId").map(String))
    )
      .map((id) => id.trim())
      .filter(Boolean);
    const itemIds = rowItemId ? [rowItemId] : submittedItemIds;

    if (itemIds.length === 0) {
      return badRequest("Nenhum sabor enviado para atualização.");
    }

    const validItems = await db.item.findMany({
      where: {
        id: { in: itemIds },
        ItemSellingChannelItem: {
          some: {
            itemSellingChannelId: selectedChannel.id,
          },
        },
      },
      select: { id: true },
    });
    const validItemIds = new Set(
      validItems.map((item: any) => String(item.id))
    );

    await db.$transaction(
      itemIds
        .filter((itemId) => validItemIds.has(itemId))
        .map((itemId) =>
          db.itemSellingInfo.upsert({
            where: { itemId },
            update: {
              baseIngredients: normalizeText(
                formData.get(`baseIngredients:${itemId}`)
              ),
              ingredients: normalizeText(formData.get(`ingredients:${itemId}`)),
              longDescription: normalizeText(
                formData.get(`longDescription:${itemId}`)
              ),
              notesPublic: normalizeText(formData.get(`notesPublic:${itemId}`)),
            },
            create: {
              itemId,
              baseIngredients: normalizeText(
                formData.get(`baseIngredients:${itemId}`)
              ),
              ingredients: normalizeText(formData.get(`ingredients:${itemId}`)),
              longDescription: normalizeText(
                formData.get(`longDescription:${itemId}`)
              ),
              notesPublic: normalizeText(formData.get(`notesPublic:${itemId}`)),
            },
          })
        )
    );

    if (normalizeChannelKey(selectedChannel.key) === "cardapio") {
      await invalidateCardapioIndexCache();
    }

    return ok(
      rowItemId
        ? "Informações comerciais do sabor atualizadas."
        : `${validItemIds.size} sabor(es) atualizados.`
    );
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasItensVendidosTextosPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const hasLoaderError = Boolean(
    loaderData?.status && loaderData.status >= 400
  );
  const payload = (loaderData?.payload || {}) as {
    channel?: {
      id: string;
      key: string;
      name: string;
    };
    items?: TextEditItem[];
  };
  const channel = payload.channel || null;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const exportHref = `/admin/vendas/itens-vendidos/${
    channel?.key || "cardapio"
  }/textos/export`;

  useEffect(() => {
    if (!actionData) return;

    if (actionData.status >= 400) {
      toast({
        title: "Erro",
        description:
          actionData.message ||
          "Nao foi possivel salvar as informações comerciais.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Informações comerciais atualizadas",
      description: actionData.message,
    });
  }, [actionData]);

  if (hasLoaderError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loaderData?.message ||
          "Não foi possível carregar as informações comerciais."}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <section className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Link
            to={`/admin/vendas/itens-vendidos/${channel?.key || "cardapio"}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
          >
            <span className="flex size-6 items-center justify-center rounded-full border border-slate-200 text-slate-500">
              <ArrowLeft className="h-3.5 w-3.5" />
            </span>
            voltar para itens vendidos
          </Link>

          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">
              Informações comerciais dos sabores
            </h1>
            <p className="text-sm text-slate-500">
              Edição rápida de base, ingredientes públicos e descrição extensa
              dos sabores para {channel?.name || "o canal selecionado"}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-200 text-slate-600">
            {items.length} sabor(es)
          </Badge>
          <Link to={exportHref} reloadDocument>
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>
          </Link>
          <Button
            type="submit"
            form="selling-texts-form"
            disabled={isSubmitting || items.length === 0}
            className="h-9 gap-2 bg-slate-900 hover:bg-slate-700"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Salvando..." : "Salvar informações comerciais"}
          </Button>
        </div>
      </section>

      {items.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          Nenhum sabor encontrado neste canal.
        </section>
      ) : (
        <Form id="selling-texts-form" method="post">
          <input type="hidden" name="_action" value="update-selling-texts" />

          <div className="w-full overflow-x-auto bg-white">
            <Table className="w-full min-w-[1320px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[17%]">Sabor</TableHead>
                  <TableHead className="w-[21%]">Base da pizza</TableHead>
                  <TableHead className="w-[21%]">
                    Ingredientes públicos
                  </TableHead>
                  <TableHead className="w-[21%]">Descrição extensa</TableHead>
                  <TableHead className="w-[12%]">Observações</TableHead>
                  <TableHead className="w-[8%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="py-4">
                      <input type="hidden" name="itemId" value={item.id} />
                      <div className="font-semibold leading-tight text-slate-950">
                        {item.name}
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <Textarea
                        id={`baseIngredients:${item.id}`}
                        name={`baseIngredients:${item.id}`}
                        defaultValue={item.baseIngredients}
                        className="min-h-24 w-full resize-y text-sm"
                        placeholder="Ex.: molho de tomate, muçarela..."
                        aria-label={`Base da pizza de ${item.name}`}
                      />
                    </TableCell>

                    <TableCell className="py-4">
                      <Textarea
                        id={`ingredients:${item.id}`}
                        name={`ingredients:${item.id}`}
                        defaultValue={item.ingredients}
                        className="min-h-24 w-full resize-y text-sm"
                        placeholder="Ex.: manjericão, tomate cereja, parmesão..."
                        aria-label={`Ingredientes públicos de ${item.name}`}
                      />
                    </TableCell>

                    <TableCell className="py-4">
                      <Textarea
                        id={`longDescription:${item.id}`}
                        name={`longDescription:${item.id}`}
                        defaultValue={item.longDescription}
                        className="min-h-24 w-full resize-y text-sm"
                        placeholder="Texto comercial mais completo para o canal."
                        aria-label={`Descrição extensa de ${item.name}`}
                      />
                    </TableCell>

                    <TableCell className="py-4">
                      <Textarea
                        id={`notesPublic:${item.id}`}
                        name={`notesPublic:${item.id}`}
                        defaultValue={item.notesPublic}
                        className="min-h-24 w-full resize-y text-sm"
                        placeholder="Observações públicas para o cliente."
                        aria-label={`Observações públicas de ${item.name}`}
                      />
                    </TableCell>

                    <TableCell className="py-4 text-right">
                      <Button
                        type="submit"
                        name="rowItemId"
                        value={item.id}
                        variant="outline"
                        size="sm"
                        disabled={isSubmitting}
                        className="h-8 gap-1.5 border-slate-200 px-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Form>
      )}
    </div>
  );
}
