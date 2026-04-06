import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { ChevronLeft } from "lucide-react";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
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

function normalizeKey(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const lastChannel = await db.itemSellingChannel.findFirst({
      orderBy: [{ sortOrderIndex: "desc" }],
      select: { sortOrderIndex: true },
    });

    return ok({
      nextSortOrderIndex: Number(lastChannel?.sortOrderIndex || 0) + 10,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const key = normalizeKey(formData.get("key"));
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim() || null;
    const feeAmount = toFloat(formData.get("feeAmount"));
    const taxPerc = toFloat(formData.get("taxPerc"));
    const onlinePaymentTaxPerc = toFloat(formData.get("onlinePaymentTaxPerc"));
    const targetMarginPerc = toFloat(formData.get("targetMarginPerc"));
    const sortOrderIndex = Math.trunc(toFloat(formData.get("sortOrderIndex")));
    const isMarketplace = formData.get("isMarketplace") === "on";

    if (!key) return badRequest("Informe a chave do canal");
    if (!/^[a-z0-9-_]+$/.test(key)) return badRequest("Chave inválida. Use letras minúsculas, números, - ou _");
    if (!name) return badRequest("Informe o nome do canal");
    if ([feeAmount, taxPerc, onlinePaymentTaxPerc, targetMarginPerc, sortOrderIndex].some((value) => !Number.isFinite(value))) {
      return badRequest("Preencha os campos numéricos com valores válidos");
    }

    const existing = await db.itemSellingChannel.findFirst({ where: { key } });
    if (existing) return badRequest("Já existe um canal com essa chave");

    const channel = await db.itemSellingChannel.create({
      data: {
        key,
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

    return redirect(`/admin/canais-venda/${channel.id}`);
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminCanaisVendaNew() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const nextSortOrderIndex = Number((loaderData?.payload as any)?.nextSortOrderIndex || 10);
  const [isMarketplace, setIsMarketplace] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-5 border-b border-slate-200/80 pb-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/admin/canais-venda"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
          >
            <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
              <ChevronLeft size={12} />
            </span>
            canais de venda
          </Link>
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Novo canal</h2>
          <p className="text-sm text-slate-500">Dados básicos, taxas e margem alvo do canal.</p>
        </div>
      </section>

      {actionData?.message ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${actionData.status >= 400 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {actionData.message}
        </div>
      ) : null}

      <Form method="post" className="space-y-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="key">Chave</Label>
                <Input id="key" name="key" placeholder="ex: ifood" required className="mt-1" />
                <p className="mt-1 text-xs text-slate-400">Usada nas matrizes de preço e URLs internas.</p>
              </div>
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="ex: iFood" required className="mt-1" />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Resumo opcional do canal para aparecer nas telas administrativas."
                className="mt-1 min-h-[96px]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sortOrderIndex">Ordem</Label>
                <Input id="sortOrderIndex" name="sortOrderIndex" type="number" defaultValue={nextSortOrderIndex} className="mt-1" />
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
          </div>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Custos do canal</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Esses percentuais alimentam a referência comercial das telas de venda.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="feeAmount">Taxa fixa</Label>
                <Input id="feeAmount" name="feeAmount" inputMode="decimal" defaultValue="0" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="taxPerc">Taxa %</Label>
                <Input id="taxPerc" name="taxPerc" inputMode="decimal" defaultValue="0" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="onlinePaymentTaxPerc">Pagamento online %</Label>
                <Input id="onlinePaymentTaxPerc" name="onlinePaymentTaxPerc" inputMode="decimal" defaultValue="0" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="targetMarginPerc">Margem alvo %</Label>
                <Input id="targetMarginPerc" name="targetMarginPerc" inputMode="decimal" defaultValue="0" className="mt-1" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Use `Marketplace` quando o canal aplicar intermediação externa e taxas típicas de agregador.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
            Criar canal
          </Button>
          <Link to="/admin/canais-venda">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
        </div>
      </Form>
    </div>
  );
}
