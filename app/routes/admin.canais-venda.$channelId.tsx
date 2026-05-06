import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function toFloat(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const channel = await db.itemSellingChannel.findUnique({
    where: { id: params.channelId },
    include: {
      _count: {
        select: {
          ItemSellingPriceVariation: true,
        },
      },
    },
  });

  if (!channel) {
    throw new Response("Canal não encontrado", { status: 404 });
  }

  return ok({ channel });
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const channelId = params.channelId;
    if (!channelId) return badRequest("Canal inválido");

    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "").trim();

    if (actionName === "channel-update") {
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim() || null;
      const feeAmount = toFloat(formData.get("feeAmount"));
      const taxPerc = toFloat(formData.get("taxPerc"));
      const onlinePaymentTaxPerc = toFloat(formData.get("onlinePaymentTaxPerc"));
      const targetMarginPerc = toFloat(formData.get("targetMarginPerc"));
      const sortOrderIndex = Math.trunc(toFloat(formData.get("sortOrderIndex")));
      const isMarketplace = formData.get("isMarketplace") === "on";

      if (!name) return badRequest("Informe o nome do canal");
      if ([feeAmount, taxPerc, onlinePaymentTaxPerc, targetMarginPerc, sortOrderIndex].some((value) => !Number.isFinite(value))) {
        return badRequest("Preencha os campos numéricos com valores válidos");
      }

      await db.itemSellingChannel.update({
        where: { id: channelId },
        data: {
          name,
          description,
          feeAmount,
          taxPerc,
          onlinePaymentTaxPerc,
          targetMarginPerc,
          sortOrderIndex,
          isMarketplace,
        },
      });

      return ok("Canal atualizado");
    }

    if (actionName === "channel-delete") {
      const channel = await db.itemSellingChannel.findUnique({
        where: { id: channelId },
        include: {
          _count: {
            select: {
              ItemSellingPriceVariation: true,
            },
          },
        },
      });

      if (!channel) return badRequest("Canal não encontrado");
      if ((channel._count?.ItemSellingPriceVariation || 0) > 0) {
        return badRequest("Este canal possui preços vinculados e não pode ser excluído");
      }

      await db.itemSellingChannel.delete({ where: { id: channelId } });
      return redirect("/admin/canais-venda");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminCanaisVendaEdit() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const channel = (loaderData?.payload as any)?.channel;
  const linkedPricesCount = Number(channel?._count?.ItemSellingPriceVariation || 0);
  const [isMarketplace, setIsMarketplace] = useState(Boolean(channel?.isMarketplace));

  const errorClass = "border-red-200 bg-red-50 text-red-700";
  const successClass = "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/admin/canais-venda"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Canais de venda
            </Link>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{channel?.name}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  channel?.isMarketplace
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-sky-200 bg-sky-50 text-sky-700"
                }
              >
                {channel?.isMarketplace ? "Marketplace" : "Canal direto"}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                {linkedPricesCount} preço(s) vinculado(s)
              </Badge>
            </div>
          </div>
        </section>

        {actionData?.message ? (
          <div className={`rounded-md border px-3 py-2 text-sm ${actionData.status >= 400 ? errorClass : successClass}`}>
            {actionData.message}
          </div>
        ) : null}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="channel-update" />

          <div>
            <Label>Chave</Label>
            <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm uppercase text-slate-700">
              {channel?.key}
            </div>
            <p className="mt-1 text-xs text-slate-400">A chave fica travada após a criação para preservar os vínculos de preço.</p>
          </div>

          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={channel?.name || ""} required className="mt-1" />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={channel?.description || ""}
              className="mt-1 min-h-[120px]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="sortOrderIndex">Ordem</Label>
              <Input
                id="sortOrderIndex"
                name="sortOrderIndex"
                type="number"
                defaultValue={channel?.sortOrderIndex ?? 0}
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
              <input
                type="checkbox"
                name="isMarketplace"
                checked={isMarketplace}
                onChange={(event) => setIsMarketplace(event.currentTarget.checked)}
              />
              Marketplace
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="feeAmount">Taxa fixa</Label>
              <Input id="feeAmount" name="feeAmount" inputMode="decimal" defaultValue={channel?.feeAmount ?? 0} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="taxPerc">Taxa %</Label>
              <Input id="taxPerc" name="taxPerc" inputMode="decimal" defaultValue={channel?.taxPerc ?? 0} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="onlinePaymentTaxPerc">Pagamento online %</Label>
              <Input
                id="onlinePaymentTaxPerc"
                name="onlinePaymentTaxPerc"
                inputMode="decimal"
                defaultValue={channel?.onlinePaymentTaxPerc ?? 0}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="targetMarginPerc">Margem alvo %</Label>
              <Input
                id="targetMarginPerc"
                name="targetMarginPerc"
                inputMode="decimal"
                defaultValue={channel?.targetMarginPerc ?? 0}
                className="mt-1"
              />
            </div>
          </div>

          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
            Salvar alterações
          </Button>
        </Form>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Uso atual</h3>
          <p className="mt-1 text-sm text-slate-600">
            Este canal aparece nas telas nativas de venda dos itens e participa da matriz de preços por variação.
          </p>
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span>Entradas de preço vinculadas</span>
              <strong>{linkedPricesCount}</strong>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-red-700">Excluir canal</h3>
          <p className="mt-1 text-sm text-red-700/90">
            A exclusão só é permitida quando não existe nenhum preço nativo ligado a este canal.
          </p>

          <Form method="post" className="mt-4">
            <input type="hidden" name="_action" value="channel-delete" />
            <Button
              type="submit"
              variant="outline"
              className="border-red-200 bg-white text-red-700 hover:bg-red-100"
              disabled={linkedPricesCount > 0}
            >
              Excluir canal
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
