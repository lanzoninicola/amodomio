import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

type VariationOption = {
  id: string;
  kind: string;
  code: string;
  name: string;
};

type LinkedVariation = {
  id: string;
  variationId: string;
  isReference: boolean;
  Variation: VariationOption | null;
};

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const db = prismaClient as any;
    const [item, allVariations, linkedVariations] = await Promise.all([
      db.item.findUnique({
        where: { id },
        select: { id: true },
      }),
      db.variation.findMany({
        where: {
          deletedAt: null,
        },
        select: { id: true, kind: true, code: true, name: true },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
      }),
      db.itemVariation.findMany({
        where: { itemId: id, deletedAt: null },
        select: {
          id: true,
          variationId: true,
          isReference: true,
          Variation: {
            select: { id: true, kind: true, code: true, name: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
    ]);

    if (!item) return badRequest("Item não encontrado");

    return ok({
      allVariations: allVariations as VariationOption[],
      linkedVariations: linkedVariations as LinkedVariation[],
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemVariationsTab() {
  const data = useLoaderData<typeof loader>();
  const payload = (data?.payload || {}) as {
    allVariations?: VariationOption[];
    linkedVariations?: LinkedVariation[];
  };

  const allVariations = payload.allVariations || [];
  const linkedVariations = payload.linkedVariations || [];
  const linkedVariationIds = linkedVariations.map((row) => row.variationId);
  const linkedReference = linkedVariations.find((row) => row.isReference);

  const [selectedVariationIds, setSelectedVariationIds] = useState<string[]>(linkedVariationIds);
  const [referenceVariationId, setReferenceVariationId] = useState<string>(
    linkedReference?.variationId || linkedVariationIds[0] || ""
  );

  const selectedSet = useMemo(() => new Set(selectedVariationIds), [selectedVariationIds]);
  const selectedVariations = allVariations.filter((variation) => selectedSet.has(variation.id));

  function toggleVariation(variationId: string, checked: boolean) {
    setSelectedVariationIds((current) => {
      const next = checked ? Array.from(new Set([...current, variationId])) : current.filter((id) => id !== variationId);

      if (!next.includes(referenceVariationId)) {
        setReferenceVariationId(next[0] || "");
      }

      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Form method="post" action=".." className="space-y-4">
        <input type="hidden" name="_action" value="item-variations-update" />
        <input type="hidden" name="referenceVariationId" value={referenceVariationId} />
        {selectedVariationIds.map((variationId) => (
          <input key={variationId} type="hidden" name="variationIds" value={variationId} />
        ))}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Todas as variações</h2>
            <p className="mt-1 text-xs text-slate-600">Selecione múltiplas variações para vincular ao item.</p>

            <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
              {allVariations.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma variação cadastrada.</p>
              ) : (
                allVariations.map((variation) => {
                  const checked = selectedSet.has(variation.id);

                  return (
                    <label
                      key={variation.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{variation.name}</div>
                        <div className="text-xs text-slate-500">
                          {variation.kind} • {variation.code}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleVariation(variation.id, event.currentTarget.checked)}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Variações vinculadas</h2>
            <p className="mt-1 text-xs text-slate-600">
              Defina qual variação será a referência para cálculo das demais.
            </p>

            <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
              {selectedVariations.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma variação vinculada.</p>
              ) : (
                selectedVariations.map((variation) => (
                  <label
                    key={variation.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{variation.name}</div>
                      <div className="text-xs text-slate-500">
                        {variation.kind} • {variation.code}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="radio"
                        name="referenceVariationSelector"
                        checked={referenceVariationId === variation.id}
                        onChange={() => setReferenceVariationId(variation.id)}
                      />
                      Referência
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
            Salvar variações
          </Button>
        </div>
      </Form>
    </div>
  );
}
