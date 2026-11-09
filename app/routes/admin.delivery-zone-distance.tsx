import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useSearchParams, useSubmit } from "@remix-run/react";
import * as React from "react";

// import { prisma } from "~/lib/prisma.server";
import prismaClient from "~/lib/prisma/client.server";
import { DecimalInput, IntegerInput } from "~/components/inputs/inputs";
import { Separator } from "~/components/ui/separator";
const prisma = prismaClient;

// -----------------------------
// Tipos do loader
// -----------------------------

type CompanyLocationDTO = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
};

type DeliveryZoneDTO = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
};

type DZDistanceDTO = {
  deliveryZoneId: string;
  companyLocationId: string;
  distanceInKm: number;
  estimatedTimeInMin: number | null;
};

type LoaderData = {
  companyLocations: CompanyLocationDTO[];
  selectedCompanyLocationId: string;
  deliveryZones: DeliveryZoneDTO[];
  distancesByDeliveryZoneId: Record<string, DZDistanceDTO | undefined>;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const selectedCompanyLocationId = url.searchParams.get("companyLocationId") || undefined;

  // Carrega todas as locations (ordenadas por nome)
  const companyLocations = await prisma.companyLocation.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, state: true },
  });

  if (companyLocations.length === 0) {
    throw new Response("Nenhuma CompanyLocation encontrada.", { status: 404 });
  }

  const activeCompanyId = selectedCompanyLocationId ?? companyLocations[0].id;

  // Carrega as DeliveryZones (ajuste o filtro se quiser limitar por cidade/UF)
  const deliveryZones = await prisma.deliveryZone.findMany({
    // Ex.: where: { city: "Pato Branco", state: "PR" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, state: true },
  });

  // Busca distâncias já existentes para a company selecionada
  const distances = await prisma.deliveryZoneDistance.findMany({
    where: { companyLocationId: activeCompanyId },
    select: {
      deliveryZoneId: true,
      companyLocationId: true,
      distanceInKm: true,
      estimatedTimeInMin: true,
    },
  });

  const distancesByDeliveryZoneId: Record<string, DZDistanceDTO> = {};
  for (const d of distances) distancesByDeliveryZoneId[d.deliveryZoneId] = d;

  const data: LoaderData = {
    companyLocations: companyLocations as CompanyLocationDTO[],
    selectedCompanyLocationId: activeCompanyId,
    deliveryZones: deliveryZones as DeliveryZoneDTO[],
    distancesByDeliveryZoneId,
  };

  return json(data);
}

// -----------------------------
// Action (Salvar em massa / Zero-fill / Delete)
// -----------------------------

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");
  const companyLocationId = String(formData.get("companyLocationId") || "");

  // --- DELETE (cancelar registro de uma delivery zone específica) ---
  if (intent === "delete") {
    const deliveryZoneId = String(formData.get("deliveryZoneId") || "");
    if (!companyLocationId || !deliveryZoneId) {
      return json(
        { ok: false, message: "companyLocationId e deliveryZoneId são obrigatórios." },
        { status: 400 }
      );
    }

    await prisma.deliveryZoneDistance.deleteMany({
      where: {
        deliveryZoneId,
        companyLocationId,
      },
    });

    // Redireciona mantendo a URL atual (com a location selecionada)
    const url = new URL(request.url);
    if (companyLocationId) url.searchParams.set("companyLocationId", companyLocationId);
    return redirect(url.pathname + "?" + url.searchParams.toString());
  }

  if (!companyLocationId) {
    return json({ ok: false, message: "companyLocationId é obrigatório." }, { status: 400 });
  }

  // Recolhe as linhas: rows[0].deliveryZoneId, rows[0].distanceInKm, rows[0].estimatedTimeInMin, etc.
  const rows: Array<{ deliveryZoneId: string; distanceInKm: number; estimatedTimeInMin: number | null }> = [];
  for (const [key, value] of formData.entries()) {
    const m = /^rows\[(\d+)\]\.(deliveryZoneId|distanceInKm|estimatedTimeInMin)$/.exec(String(key));
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2] as "deliveryZoneId" | "distanceInKm" | "estimatedTimeInMin";
    if (!rows[idx]) rows[idx] = { deliveryZoneId: "", distanceInKm: 0, estimatedTimeInMin: 0 };
    if (field === "deliveryZoneId") rows[idx].deliveryZoneId = String(value);
    if (field === "distanceInKm") rows[idx].distanceInKm = Number(value || 0);
    if (field === "estimatedTimeInMin") rows[idx].estimatedTimeInMin = value === "" ? null : Number(value);
  }

  // Zero-fill do lado do servidor (se solicitado)
  if (intent === "zero-fill") {
    const zones = await prisma.deliveryZone.findMany({
      select: { id: true },
    });
    rows.length = 0;
    for (const z of zones) rows.push({ deliveryZoneId: z.id, distanceInKm: 0, estimatedTimeInMin: 0 });
  }

  // UPSERT para cada linha
  for (const row of rows) {
    if (!row?.deliveryZoneId) continue;
    const distanceInKm = isFinite(row.distanceInKm) ? row.distanceInKm : 0;
    const estimatedTimeInMin =
      row.estimatedTimeInMin == null || !isFinite(Number(row.estimatedTimeInMin))
        ? 0
        : Number(row.estimatedTimeInMin);

    await prisma.deliveryZoneDistance.upsert({
      where: {
        deliveryZoneId_companyLocationId: {
          deliveryZoneId: row.deliveryZoneId,
          companyLocationId,
        },
      },
      update: {
        distanceInKm,
        estimatedTimeInMin,
      },
      create: {
        deliveryZoneId: row.deliveryZoneId,
        companyLocationId,
        distanceInKm,
        estimatedTimeInMin,
      },
    });
  }

  // Volta para a página atual, mantendo a location
  const url = new URL(request.url);
  url.searchParams.set("companyLocationId", companyLocationId);
  return redirect(url.pathname + "?" + url.searchParams.toString());
}

// -----------------------------
// Componente da página
// -----------------------------

export default function DeliveryZoneDistancePage() {
  const { companyLocations, selectedCompanyLocationId, deliveryZones, distancesByDeliveryZoneId } =
    useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [filter, setFilter] = React.useState("");
  const selectedId = searchParams.get("companyLocationId") || selectedCompanyLocationId;

  const filteredZones = React.useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return deliveryZones;
    return deliveryZones.filter((z) => z.name.toLowerCase().includes(f));
  }, [filter, deliveryZones]);

  // Zero-fill no cliente (preenche campos do form com zeros)
  function zeroFillAll(form: HTMLFormElement | null) {
    if (!form) return;
    const kmInputs = form.querySelectorAll<HTMLInputElement>('input[name$=".distanceInKm"]');
    const minInputs = form.querySelectorAll<HTMLInputElement>('input[name$=".estimatedTimeInMin"]');
    kmInputs.forEach((i) => (i.value = "0"));
    minInputs.forEach((i) => (i.value = "0"));
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end justify-between w-full">
        <div>
          <h1 className="text-2xl font-semibold">Zonas de Entrega – Distâncias</h1>
          <p className="text-sm text-muted-foreground">
            Selecione a unidade e edite distância (km) e tempo (min) por zona de entrega.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationSelect
            companyLocations={companyLocations}
            value={selectedId}
            onChange={(id) => {
              const url = new URL(window.location.href);
              url.searchParams.set("companyLocationId", id);
              // Usa submit com method GET para atualizar o loader
              submit(null, { method: "GET", action: `${url.pathname}?${url.searchParams.toString()}` });
            }}
          />
        </div>
      </header>

      <Separator className="my-8" />

      <Form method="POST" className="bg-white/50">
        <input type="hidden" name="companyLocationId" value={selectedId} />

        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              name="intent"
              value="save"
              className="rounded-2xl px-4 py-2 text-sm font-medium shadow hover:shadow-md border bg-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando…" : "Salvar tudo"}
            </button>
            <button
              type="button"
              onClick={(e) => zeroFillAll(e.currentTarget.closest("form"))}
              className="rounded-2xl px-4 py-2 text-sm font-medium shadow hover:shadow-md border"
            >
              Preencher tudo com 0 (cliente)
            </button>
            <button
              type="submit"
              name="intent"
              value="zero-fill"
              className="rounded-2xl px-4 py-2 text-sm font-medium shadow hover:shadow-md border"
              title="Servidor fará zero-fill para todas as DeliveryZones"
            >
              Zero-fill (servidor)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filtrar zonas…"
              className="w-64 rounded-xl border px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[820px] table-fixed">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm">
                <th className="w-12 px-3 py-2">#</th>
                <th className="px-3 py-2">Zona de Entrega</th>
                <th className="w-36 px-3 py-2">Distância (km)</th>
                <th className="w-40 px-3 py-2">Tempo (min)</th>
                <th className="w-28 px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredZones.map((z, idx) => {
                const dist = distancesByDeliveryZoneId[z.id];
                const defaultKm = dist?.distanceInKm ?? 0;
                const defaultMin = dist?.estimatedTimeInMin ?? 0;
                const hasRecord = !!dist;

                return (
                  <tr key={z.id} className="border-t hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-xs text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{z.name}</div>
                      {(z.city || z.state) ? (
                        <div className="text-xs text-gray-500">{z.city ?? ""}{z.city && z.state ? "/" : ""}{z.state ?? ""}</div>
                      ) : null}
                      <input type="hidden" name={`rows[${idx}].deliveryZoneId`} value={z.id} />
                    </td>
                    <td className="px-3 py-2">
                      <DecimalInput
                        name={`rows[${idx}].distanceInKm`}
                        defaultValue={defaultKm}
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <IntegerInput
                        name={`rows[${idx}].estimatedTimeInMin`}
                        defaultValue={defaultMin}
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {hasRecord ? (
                        <Form method="post" replace>
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="companyLocationId" value={selectedId} />
                          <input type="hidden" name="deliveryZoneId" value={z.id} />
                          <button
                            type="submit"
                            className="rounded-xl border px-3 py-2 text-sm hover:shadow-md"
                            onClick={(e) => {
                              if (!confirm(`Excluir registro de distância para "${z.name}"?`)) {
                                e.preventDefault();
                              }
                            }}
                            title="Excluir registro desta linha"
                          >
                            Excluir
                          </button>
                        </Form>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            name="intent"
            value="save"
            className="rounded-2xl px-4 py-2 text-sm font-medium shadow hover:shadow-md border bg-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Salvando…" : "Salvar tudo"}
          </button>
        </div>
      </Form>
    </div>
  );
}

function LocationSelect({
  companyLocations,
  value,
  onChange,
}: {
  companyLocations: CompanyLocationDTO[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Unidade</span>
      <select
        className="rounded-xl border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {companyLocations.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.city ? `– ${c.city}/${c.state ?? ""}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
