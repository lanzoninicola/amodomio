import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import {
  createProductLine,
  deleteProductLine,
  listProductLinesForManagement,
  normalizeProductLineKey,
  updateProductLine,
} from "~/domain/product-line/product-line.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [
  { title: "Linhas de produtos | Vendas" },
];

export async function loader(_args: LoaderFunctionArgs) {
  try {
    return ok(await listProductLinesForManagement());
  } catch (error) {
    return serverError(error);
  }
}

function readProductLineForm(
  values: Record<string, FormDataEntryValue>,
  channelIds: string[]
) {
  const name = String(values.name || "").trim();
  const key = normalizeProductLineKey(String(values.key || name));

  return {
    name,
    key,
    description: String(values.description || "").trim() || null,
    sortOrderIndex:
      Number.parseInt(String(values.sortOrderIndex || "0"), 10) || 0,
    active: values.active === "on",
    visibleChannelIds: channelIds.filter(
      (channelId) => values[`channel:${channelId}`] === "on"
    ),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);
    const channels = await prismaClient.itemSellingChannel.findMany({
      select: { id: true },
    });
    const channelIds = channels.map((channel) => channel.id);

    if (_action === "product-line-create") {
      const input = readProductLineForm(values, channelIds);
      if (!input.name) return badRequest("Informe o nome da linha.");
      if (!input.key) return badRequest("Informe uma chave válida.");

      const existing = await prismaClient.productLine.findUnique({
        where: { key: input.key },
        select: { id: true },
      });
      if (existing) return badRequest("Já existe uma linha com essa chave.");

      await createProductLine(input);
      return ok({ message: "Linha de produto cadastrada." });
    }

    if (_action === "product-line-update") {
      const productLineId = String(values.productLineId || "").trim();
      const input = readProductLineForm(values, channelIds);
      if (!productLineId) return badRequest("Linha de produto inválida.");
      if (!input.name) return badRequest("Informe o nome da linha.");
      if (!input.key) return badRequest("Informe uma chave válida.");

      const existing = await prismaClient.productLine.findFirst({
        where: { key: input.key, id: { not: productLineId } },
        select: { id: true },
      });
      if (existing) return badRequest("Já existe outra linha com essa chave.");

      await updateProductLine(productLineId, input);
      return ok({ message: "Linha de produto atualizada." });
    }

    if (_action === "product-line-delete") {
      const productLineId = String(values.productLineId || "").trim();
      if (!productLineId) return badRequest("Linha de produto inválida.");

      const result = await deleteProductLine(productLineId);
      if (!result.deleted) {
        return badRequest(
          `Essa linha possui ${result.groupCount} grupo(s). Mova ou exclua os grupos antes de remover a linha.`
        );
      }

      return ok({ message: "Linha de produto excluída." });
    }

    return badRequest("Ação inválida.");
  } catch (error) {
    return serverError(error);
  }
}

function ChannelVisibilityFields({
  channels,
  visibleChannelIds = [],
}: {
  channels: Array<{ id: string; key: string; name: string }>;
  visibleChannelIds?: string[];
}) {
  const visibleIds = new Set(visibleChannelIds);

  return (
    <div className="space-y-2">
      <Label>Visibilidade por canal</Label>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {channels.map((channel) => (
          <Label
            key={channel.id}
            className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm">{channel.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {channel.key}
              </span>
            </span>
            <Switch
              name={`channel:${channel.id}`}
              defaultChecked={visibleIds.has(channel.id)}
            />
          </Label>
        ))}
      </div>
    </div>
  );
}

export default function AdminProductLinesRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const productLines = loaderData?.payload?.productLines || [];
  const sellingChannels = loaderData?.payload?.sellingChannels || [];

  useEffect(() => {
    if (!actionData) return;
    toast({
      title: actionData.status === 200 ? "OK" : "Erro",
      description: actionData.message,
    });
  }, [actionData]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Linhas de produtos</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Organize o catálogo acima dos grupos e escolha em quais canais cada
          linha pode aparecer. O item ainda precisa estar visível
          individualmente no mesmo canal.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <h2 className="font-medium">Nova linha</h2>
        </div>
        <Form method="post" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="new-product-line-name">Nome</Label>
              <Input
                id="new-product-line-name"
                name="name"
                placeholder="Ex.: Sobremesas"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-product-line-key">Chave</Label>
              <Input
                id="new-product-line-key"
                name="key"
                placeholder="Gerada pelo nome se ficar vazia"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-product-line-sort">Ordem</Label>
              <Input
                id="new-product-line-sort"
                name="sortOrderIndex"
                type="number"
                defaultValue={1000}
              />
            </div>
            <Label className="flex items-end gap-2 pb-2">
              <Switch name="active" defaultChecked />
              Linha ativa
            </Label>
            <div className="space-y-1 md:col-span-2 xl:col-span-4">
              <Label htmlFor="new-product-line-description">Descrição</Label>
              <Textarea
                id="new-product-line-description"
                name="description"
                rows={2}
                placeholder="Contexto e finalidade desta linha"
              />
            </div>
          </div>
          <ChannelVisibilityFields channels={sellingChannels} />
          <Button name="_action" value="product-line-create" type="submit">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar linha
          </Button>
        </Form>
      </section>

      <Separator />

      <section className="space-y-6">
        <div>
          <h2 className="font-medium">Linhas cadastradas</h2>
          <p className="text-sm text-muted-foreground">
            {productLines.length} linha(s) no domínio comercial.
          </p>
        </div>

        {productLines.map((line, index) => {
          const visibleChannelIds = line.ProductLineSellingChannel.filter(
            (entry) => entry.visible
          ).map((entry) => entry.itemSellingChannelId);

          return (
            <div key={line.id} className="space-y-5">
              {index > 0 ? <Separator /> : null}
              <Form method="post" className="space-y-4">
                <input type="hidden" name="productLineId" value={line.id} />
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-medium">{line.name}</h3>
                  <Badge variant={line.active ? "outline" : "secondary"}>
                    {line.active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Badge variant="secondary">
                    {line._count.ItemGroup} grupo(s)
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor={`product-line-name-${line.id}`}>Nome</Label>
                    <Input
                      id={`product-line-name-${line.id}`}
                      name="name"
                      defaultValue={line.name}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`product-line-key-${line.id}`}>Chave</Label>
                    <Input
                      id={`product-line-key-${line.id}`}
                      name="key"
                      defaultValue={line.key}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`product-line-sort-${line.id}`}>
                      Ordem
                    </Label>
                    <Input
                      id={`product-line-sort-${line.id}`}
                      name="sortOrderIndex"
                      type="number"
                      defaultValue={line.sortOrderIndex}
                    />
                  </div>
                  <Label className="flex items-end gap-2 pb-2">
                    <Switch name="active" defaultChecked={line.active} />
                    Linha ativa
                  </Label>
                  <div className="space-y-1 md:col-span-2 xl:col-span-4">
                    <Label htmlFor={`product-line-description-${line.id}`}>
                      Descrição
                    </Label>
                    <Textarea
                      id={`product-line-description-${line.id}`}
                      name="description"
                      rows={2}
                      defaultValue={line.description || ""}
                    />
                  </div>
                </div>

                <ChannelVisibilityFields
                  channels={sellingChannels}
                  visibleChannelIds={visibleChannelIds}
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="submit"
                    name="_action"
                    value="product-line-delete"
                    variant="destructive"
                    disabled={line._count.ItemGroup > 0}
                    title={
                      line._count.ItemGroup > 0
                        ? "Mova os grupos antes de excluir esta linha"
                        : "Excluir linha"
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                  <Button
                    type="submit"
                    name="_action"
                    value="product-line-update"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </Button>
                </div>
              </Form>
            </div>
          );
        })}
      </section>
    </div>
  );
}
