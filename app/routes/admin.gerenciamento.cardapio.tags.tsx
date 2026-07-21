import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Tags | Cardápio" }];

function normalizeColorHex(value: FormDataEntryValue | undefined) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return "#FFFFFF";
}

function readTagForm(values: Record<string, FormDataEntryValue>) {
  return {
    name: String(values.tagName || "").trim(),
    description: String(values.description || "").trim() || null,
    public: values.public === "on",
    clickable: values.clickable === "on",
    featuredFilter: values.featuredFilter === "on",
    colorHEX: normalizeColorHex(values.colorHEX),
    sortOrderIndex:
      Number.parseInt(String(values.sortOrderIndex || "0"), 10) || 0,
  };
}

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const tags = await prismaClient.tag.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    });

    return ok({ tags });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "tag-create") {
      const data = readTagForm(values);
      if (!data.name) return badRequest("Nome da tag inválido");

      const existing = await prismaClient.tag.findFirst({
        where: { name: data.name, deletedAt: null },
        select: { id: true },
      });

      if (existing) return badRequest("Já existe uma tag com esse nome.");

      await tagPrismaEntity.create({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      return ok({ message: "Tag cadastrada." });
    }

    if (_action === "tag-update") {
      const tagId = String(values.tagId || "").trim();
      const data = readTagForm(values);
      if (!tagId) return badRequest("Tag inválida");
      if (!data.name) return badRequest("Nome da tag inválido");

      const existing = await prismaClient.tag.findFirst({
        where: {
          name: data.name,
          deletedAt: null,
          id: { not: tagId },
        },
        select: { id: true },
      });

      if (existing) return badRequest("Já existe outra tag com esse nome.");

      await tagPrismaEntity.update(tagId, data);

      return ok({ message: "Tag atualizada." });
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminCardapioTagsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const tags = loaderData?.payload?.tags || [];

  if (actionData && actionData.status > 399) {
    toast({
      title: "Erro",
      description: actionData.message,
    });
  }

  if (actionData && actionData.status === 200) {
    toast({
      title: "OK",
      description: actionData.message,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">Tags do cardápio</h2>
        <p className="text-sm text-muted-foreground">
          Configure aqui a exibição pública, o clique e a descrição exibida ao
          cliente. A página do item fica apenas para vincular a tag ao sabor.
        </p>
      </div>

      <Form method="post" className="rounded-lg border p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="new-tag-name">Nome</Label>
            <Input id="new-tag-name" name="tagName" placeholder="Nova tag" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-tag-color">Cor</Label>
            <Input
              id="new-tag-color"
              name="colorHEX"
              defaultValue="#FFFFFF"
              placeholder="#FFFFFF"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-tag-sort">Ordem</Label>
            <Input
              id="new-tag-sort"
              name="sortOrderIndex"
              type="number"
              defaultValue={0}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Label className="flex items-center gap-2 text-sm">
              <Switch name="public" />
              Pública
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Switch name="clickable" />
              Clicável
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Switch name="featuredFilter" />
              Destaque
            </Label>
          </div>
          <div className="space-y-1 lg:col-span-4">
            <Label htmlFor="new-tag-description">Descrição pública</Label>
            <Textarea
              id="new-tag-description"
              name="description"
              rows={3}
              placeholder="Texto exibido na modal do cardápio"
            />
          </div>
        </div>
        <div className="mt-3">
          <SubmitButton
            actionName="tag-create"
            labelClassName="text-xs"
            variant="outline"
            tabIndex={0}
            iconColor="black"
          />
        </div>
      </Form>

      <div className="grid gap-3 lg:grid-cols-4">
        {tags.map((tag) => (
          <Form key={tag.id} method="post" className="rounded-lg border p-3">
            <input type="hidden" name="tagId" value={tag.id} />
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label htmlFor={`tag-name-${tag.id}`}>Nome</Label>
                <Input
                  id={`tag-name-${tag.id}`}
                  name="tagName"
                  defaultValue={tag.name}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`tag-color-${tag.id}`}>Cor</Label>
                  <Input
                    id={`tag-color-${tag.id}`}
                    name="colorHEX"
                    defaultValue={tag.colorHEX}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`tag-sort-${tag.id}`}>Ordem</Label>
                  <Input
                    id={`tag-sort-${tag.id}`}
                    name="sortOrderIndex"
                    type="number"
                    defaultValue={tag.sortOrderIndex}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`tag-description-${tag.id}`}>Descrição</Label>
                <Textarea
                  id={`tag-description-${tag.id}`}
                  name="description"
                  rows={4}
                  defaultValue={tag.description || ""}
                  placeholder="Descrição exibida ao cliente"
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <Label className="flex items-center gap-2 text-sm">
                  <Switch name="public" defaultChecked={tag.public} />
                  Pública
                </Label>
                <Label className="flex items-center gap-2 text-sm">
                  <Switch name="clickable" defaultChecked={tag.clickable} />
                  Clicável
                </Label>
                <Label className="flex items-center gap-2 text-sm">
                  <Switch
                    name="featuredFilter"
                    defaultChecked={tag.featuredFilter}
                  />
                  Destaque
                </Label>
              </div>
              <SubmitButton
                actionName="tag-update"
                labelClassName="text-xs"
                variant="outline"
                tabIndex={0}
                iconColor="black"
              />
            </div>
          </Form>
        ))}
      </div>
    </div>
  );
}
