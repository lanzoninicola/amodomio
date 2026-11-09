import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  formatVariationDetailValue,
  inferVariationDetailValueType,
  normalizeVariationDetailKey,
  parseVariationDetailValue,
  VARIATION_DETAIL_PRESETS,
  type VariationDetailValueType,
} from "~/domain/item/variation-detail";
import { variationPrismaEntity } from "~/domain/item/variation.prisma.entity.server";
import prisma from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function str(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function int(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Id da variação não informado");

    const variation = await variationPrismaEntity.findById(id);
    if (!variation || variation.deletedAt) {
      return badRequest("Variação não encontrada");
    }

    return ok({ variation });
  } catch (error) {
    if (error instanceof Error) {
      return badRequest(error.message);
    }
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Id da variação não informado");

    const formData = await request.formData();
    const action = str(formData.get("_action"));

    if (action === "variation-update") {
      await variationPrismaEntity.update(id, {
        kind: str(formData.get("kind")),
        code: str(formData.get("code")),
        name: str(formData.get("name")),
        sortOrderIndex: int(formData.get("sortOrderIndex")),
        additionalInformation: str(formData.get("additionalInformation")),
      });

      return ok({ message: "Variação atualizada com sucesso" });
    }

    if (action === "variation-delete") {
      await variationPrismaEntity.softDelete(id);
      return redirect("/admin/variations");
    }

    if (action === "detail-upsert") {
      const key = normalizeVariationDetailKey(str(formData.get("key")));
      const valueType = str(
        formData.get("valueType")
      ) as VariationDetailValueType;
      if (!["string", "number", "boolean", "json"].includes(valueType)) {
        return badRequest("Tipo de valor inválido");
      }
      const value = parseVariationDetailValue(
        str(formData.get("value")),
        valueType
      );

      await prisma.variationDetail.upsert({
        where: { variationId_key: { variationId: id, key } },
        create: { variationId: id, key, value },
        update: { value },
      });
      return ok({ message: "Detalhe salvo com sucesso" });
    }

    if (action === "detail-delete") {
      const detailId = str(formData.get("detailId"));
      if (!detailId) return badRequest("Detalhe não informado");
      await prisma.variationDetail.deleteMany({
        where: { id: detailId, variationId: id },
      });
      return ok({ message: "Detalhe removido com sucesso" });
    }

    return badRequest("Ação inválida");
  } catch (error) {
    if (error instanceof Error) {
      return badRequest(error.message);
    }
    return serverError(error);
  }
}

export default function AdminVariationDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const variation = loaderData?.payload?.variation as any;
  const actionMessage = actionData?.message || actionData?.payload?.message;

  if (!variation) {
    return (
      <div className="p-4 text-sm text-slate-500">Variação não encontrada.</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Variação</h1>
            <p className="text-xs text-slate-500">
              Edite os dados do catálogo global de variações.
            </p>
          </div>
          <Link
            to="/admin/variations"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ChevronLeft size={14} />
            Voltar para lista
          </Link>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <CardTitle>{variation.name}</CardTitle>
            <Badge
              variant="outline"
              className="border-slate-200 bg-white font-mono text-xs text-slate-700"
            >
              {variation.kind}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">ID: {variation.id}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!!actionMessage && (
            <p className="text-sm text-emerald-700">{String(actionMessage)}</p>
          )}

          <Form method="post" className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="_action" value="variation-update" />

            <div className="grid gap-2">
              <Label htmlFor="kind">Kind</Label>
              <Input
                id="kind"
                name="kind"
                defaultValue={variation.kind}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                defaultValue={variation.code}
                required
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                defaultValue={variation.name}
                required
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="sortOrderIndex">Sort order</Label>
              <Input
                id="sortOrderIndex"
                name="sortOrderIndex"
                type="number"
                defaultValue={Number(variation.sortOrderIndex || 0)}
                required
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="additionalInformation">
                Informações adicionais
              </Label>
              <Textarea
                id="additionalInformation"
                name="additionalInformation"
                defaultValue={variation.additionalInformation || ""}
                className="min-h-[120px]"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
                Salvar alterações
              </Button>
            </div>
          </Form>

          <div className="border-t border-slate-200 pt-4">
            <Form
              method="post"
              onSubmit={(e) => {
                if (!confirm("Remover esta variação?")) e.preventDefault();
              }}
            >
              <input type="hidden" name="_action" value="variation-delete" />
              <Button type="submit" variant="destructive">
                Excluir variação
              </Button>
            </Form>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Detalhes estruturados</CardTitle>
          <p className="text-sm text-slate-500">
            Metadados opcionais desta variação. Para tamanhos, informe
            capacidade de pessoas e sabores; outros tipos podem usar suas
            próprias chaves.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Chaves sugeridas:{" "}
            {VARIATION_DETAIL_PRESETS.map(
              (preset) => `${preset.key} (${preset.label})`
            ).join(", ")}
            . Salvar a mesma chave atualiza seu valor.
          </div>

          <Form
            method="post"
            className="grid gap-3 md:grid-cols-[1fr_180px_1.5fr_auto] md:items-end"
          >
            <input type="hidden" name="_action" value="detail-upsert" />
            <div className="grid gap-2">
              <Label htmlFor="detail-key">Chave</Label>
              <Input
                id="detail-key"
                name="key"
                list="variation-detail-presets"
                placeholder="maxServeAmount"
                required
              />
              <datalist id="variation-detail-presets">
                {VARIATION_DETAIL_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-value-type">Tipo</Label>
              <Select name="valueType" defaultValue="string">
                <SelectTrigger id="detail-value-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="boolean">Booleano</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-value">Valor</Label>
              <Input
                id="detail-value"
                name="value"
                placeholder="Ex.: 4"
                required
              />
            </div>
            <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
              Adicionar ou atualizar
            </Button>
          </Form>

          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {variation.VariationDetail?.length ? (
              variation.VariationDetail.map((detail: any) => (
                <div
                  key={detail.id}
                  className="grid gap-3 p-3 md:grid-cols-[1fr_140px_1.5fr_auto] md:items-center"
                >
                  <code className="text-xs font-semibold text-slate-800">
                    {detail.key}
                  </code>
                  <Badge variant="outline" className="w-fit">
                    {inferVariationDetailValueType(detail.value)}
                  </Badge>
                  <span className="break-all text-sm text-slate-600">
                    {formatVariationDetailValue(detail.value)}
                  </span>
                  <Form
                    method="post"
                    onSubmit={(event) => {
                      if (!confirm("Remover este detalhe?"))
                        event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="_action" value="detail-delete" />
                    <input type="hidden" name="detailId" value={detail.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      Excluir
                    </Button>
                  </Form>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-slate-500">
                Nenhum detalhe estruturado cadastrado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
