import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import {
  Await,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
import { Download, Loader2, Pizza, Plus, Save, Trash2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { SizeSelector, defaultSizeCounts, type SizeCounts } from "~/domain/kds";
import DeliveryZoneCombobox from "~/domain/kds/components/delivery-zone-combobox";
import prisma from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Reservas de pizza | Marketing" },
];

const SIZE_LABELS: Record<keyof SizeCounts, string> = {
  F: "Família",
  M: "Média",
  P: "Pequena",
  I: "Individual",
  FT: "Fatia",
};

const RESERVATION_SIZE_KEYS: Array<keyof SizeCounts> = ["F", "M", "P", "I"];
const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "credito", label: "Crédito" },
  { value: "debito", label: "Débito" },
  { value: "outro", label: "Outro" },
] as const;

function parseSizes(value: string | null): SizeCounts {
  if (!value) return defaultSizeCounts();
  try {
    return { ...defaultSizeCounts(), ...JSON.parse(value) };
  } catch {
    return defaultSizeCounts();
  }
}

function normalizeCount(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function campaignPeriod(validFrom: string | Date, validTo: string | Date) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${formatter.format(new Date(validFrom))} a ${formatter.format(
    new Date(validTo)
  )}`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function paymentMethodLabel(value: string | null) {
  return (
    PAYMENT_METHODS.find((method) => method.value === value)?.label ??
    value ??
    ""
  );
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { deletedAt: null },
    orderBy: [{ validFrom: "desc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      validFrom: true,
      validTo: true,
    },
  });

  if (!params.campaignKey && campaigns[0]) {
    throw redirect(`/admin/marketing/reservas-pizza/${campaigns[0].key}`);
  }

  const selectedCampaign =
    campaigns.find((campaign) => campaign.key === params.campaignKey) ?? null;

  if (params.campaignKey && !selectedCampaign && campaigns[0]) {
    throw redirect(`/admin/marketing/reservas-pizza/${campaigns[0].key}`);
  }

  if (
    selectedCampaign &&
    new URL(request.url).searchParams.get("export") === "excel"
  ) {
    const rows = await prisma.marketingPizzaReservation.findMany({
      where: { campaignId: selectedCampaign.id, deletedAt: null },
      orderBy: { sequenceNumber: "asc" },
      include: { deliveryZone: { select: { name: true } } },
    });
    const header = [
      "Reserva",
      "Cliente",
      "Telefone",
      "Familia",
      "Media",
      "Pequena",
      "Individual",
      "Combo",
      "Bairro",
      "Retirada",
      "Endereco",
      "Detalhe do pedido",
      "Forma de pagamento",
      "Virou pedido",
    ];
    const lines = rows.map((row) => {
      const sizes = parseSizes(row.size);
      return [
        row.sequenceNumber,
        row.customerName,
        row.customerPhone,
        sizes.F,
        sizes.M,
        sizes.P,
        sizes.I,
        row.comboCount,
        row.deliveryZone?.name,
        row.takeAway ? "Sim" : "Não",
        row.address,
        row.orderDetails,
        paymentMethodLabel(row.paymentMethod),
        row.convertedToOrder ? "Sim" : "Não",
      ]
        .map(csvCell)
        .join(";");
    });
    const csv = `\uFEFF${header.map(csvCell).join(";")}\r\n${lines.join(
      "\r\n"
    )}`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${selectedCampaign.key}-reservas.csv"`,
      },
    });
  }

  async function loadReservations() {
    if (!selectedCampaign) return [];

    return prisma.marketingPizzaReservation.findMany({
      where: { campaignId: selectedCampaign.id, deletedAt: null },
      orderBy: { sequenceNumber: "asc" },
      include: {
        deliveryZone: { select: { id: true, name: true } },
      },
    });
  }

  const reservations = loadReservations();

  const deliveryZones = await prisma.deliveryZone.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return defer({ campaigns, selectedCampaign, reservations, deliveryZones });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("_intent") ?? "");
  const campaign = params.campaignKey
    ? await prisma.marketingCampaign.findFirst({
        where: { key: params.campaignKey, deletedAt: null },
        select: { id: true },
      })
    : null;

  if (!campaign) {
    return json({ ok: false, error: "Campanha inválida." }, { status: 400 });
  }

  if (intent === "add") {
    const last = await prisma.marketingPizzaReservation.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    const created = await prisma.marketingPizzaReservation.create({
      data: {
        campaignId: campaign.id,
        sequenceNumber: (last?.sequenceNumber ?? 0) + 1,
      },
      select: { id: true },
    });
    return json({ ok: true, id: created.id });
  }

  const id = String(form.get("id") ?? "");
  if (!id) {
    return json({ ok: false, error: "Reserva inválida." }, { status: 400 });
  }

  const reservation = await prisma.marketingPizzaReservation.findFirst({
    where: { id, campaignId: campaign.id, deletedAt: null },
    select: { id: true },
  });
  if (!reservation) {
    return json(
      { ok: false, error: "Reserva não pertence à campanha selecionada." },
      { status: 404 }
    );
  }

  if (intent === "delete") {
    await prisma.marketingPizzaReservation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return json({ ok: true, deleted: true });
  }

  if (intent === "save") {
    const customerName = String(form.get("customerName") ?? "").trim();
    const customerPhone = String(form.get("customerPhone") ?? "").trim();
    const deliveryZoneId = String(form.get("deliveryZoneId") ?? "").trim();
    const paymentMethodRaw = String(form.get("paymentMethod") ?? "").trim();
    const paymentMethod =
      paymentMethodRaw === "nao-informado" ? "" : paymentMethodRaw;
    const address = String(form.get("address") ?? "").trim();
    const orderDetails = String(form.get("orderDetails") ?? "").trim();
    const sizes: SizeCounts = {
      F: normalizeCount(form.get("sizeF")),
      M: normalizeCount(form.get("sizeM")),
      P: normalizeCount(form.get("sizeP")),
      I: normalizeCount(form.get("sizeI")),
      FT: normalizeCount(form.get("sizeFT")),
    };

    await prisma.marketingPizzaReservation.update({
      where: { id },
      data: {
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        size: JSON.stringify(sizes),
        comboCount: normalizeCount(form.get("comboCount")),
        deliveryZoneId: deliveryZoneId || null,
        takeAway: String(form.get("takeAway") ?? "") === "on",
        convertedToOrder: String(form.get("convertedToOrder") ?? "") === "on",
        paymentMethod: paymentMethod || null,
        address: address || null,
        orderDetails: orderDetails || null,
      },
    });
    return json({ ok: true, id });
  }

  return json({ ok: false, error: "Ação inválida." }, { status: 400 });
}

type Reservation = {
  id: string;
  campaignId: string;
  sequenceNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  size: string | null;
  comboCount: number;
  deliveryZoneId: string | null;
  deliveryZone: { id: string; name: string } | null;
  takeAway: boolean;
  convertedToOrder: boolean;
  paymentMethod: string | null;
  address: string | null;
  orderDetails: string | null;
};

function ComboSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={`h-10 rounded-full border px-3 text-sm font-semibold ${
          value > 0 ? "bg-violet-700 text-white" : "bg-white"
        }`}
      >
        Combo{value > 0 ? ` ${value}` : ""}
      </button>
      {value > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(0)}
        >
          Zerar
        </Button>
      ) : null}
    </div>
  );
}

function ReservationRow({
  reservation,
  deliveryZones,
}: {
  reservation: Reservation;
  deliveryZones: Array<{ id: string; name: string }>;
}) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [sizes, setSizes] = useState(() => parseSizes(reservation.size));
  const [comboCount, setComboCount] = useState(reservation.comboCount);
  const [customerName, setCustomerName] = useState(
    reservation.customerName ?? ""
  );
  const [customerPhone, setCustomerPhone] = useState(
    reservation.customerPhone ?? ""
  );
  const [paymentMethod, setPaymentMethod] = useState(
    reservation.paymentMethod ?? "nao-informado"
  );
  const [address, setAddress] = useState(reservation.address ?? "");
  const [orderDetails, setOrderDetails] = useState(
    reservation.orderDetails ?? ""
  );
  const [deliveryZoneId, setDeliveryZoneId] = useState<string | null>(
    reservation.deliveryZoneId
  );
  const [takeAway, setTakeAway] = useState(reservation.takeAway);
  const [convertedToOrder, setConvertedToOrder] = useState(
    reservation.convertedToOrder
  );
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    setSizes(parseSizes(reservation.size));
    setComboCount(reservation.comboCount);
    setCustomerName(reservation.customerName ?? "");
    setCustomerPhone(reservation.customerPhone ?? "");
    setPaymentMethod(reservation.paymentMethod ?? "nao-informado");
    setAddress(reservation.address ?? "");
    setOrderDetails(reservation.orderDetails ?? "");
    setDeliveryZoneId(reservation.deliveryZoneId);
    setTakeAway(reservation.takeAway);
    setConvertedToOrder(reservation.convertedToOrder);
  }, [reservation]);

  return (
    <div className="bg-white py-4">
      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="id" value={reservation.id} />
        <input
          type="hidden"
          name="deliveryZoneId"
          value={deliveryZoneId ?? ""}
        />
        {(Object.keys(sizes) as Array<keyof SizeCounts>).map((key) => (
          <input
            key={key}
            type="hidden"
            name={`size${key}`}
            value={sizes[key]}
          />
        ))}
        <input type="hidden" name="comboCount" value={comboCount} />
        <input type="hidden" name="customerName" value={customerName} />
        <input type="hidden" name="customerPhone" value={customerPhone} />
        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <input type="hidden" name="address" value={address} />
        <input type="hidden" name="orderDetails" value={orderDetails} />
        <input type="hidden" name="takeAway" value={takeAway ? "on" : ""} />
        <input
          type="hidden"
          name="convertedToOrder"
          value={convertedToOrder ? "on" : ""}
        />

        <div className="grid gap-3 lg:grid-cols-[70px,minmax(220px,1fr),180px,minmax(390px,1.7fr),180px] lg:items-end">
          <div
            className={`flex h-10 items-center justify-center rounded-lg font-mono text-lg font-bold ${
              convertedToOrder
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            #{reservation.sequenceNumber}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Cliente
              </span>
              <CopyButton
                textToCopy={customerName}
                variant="ghost"
                classNameButton="mr-0 h-5 w-5"
                classNameIcon="h-3.5 w-3.5 text-slate-500"
                toastContent="Nome copiado"
              />
            </div>
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Telefone
              </span>
              <CopyButton
                textToCopy={customerPhone}
                variant="ghost"
                classNameButton="mr-0 h-5 w-5"
                classNameIcon="h-3.5 w-3.5 text-slate-500"
                toastContent="Telefone copiado"
              />
            </div>
            <Input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="Telefone"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Tamanhos e combo
            </span>
            <div className="flex min-h-10 flex-wrap items-center gap-3">
              <SizeSelector
                counts={sizes}
                onChange={setSizes}
                visibleKeys={RESERVATION_SIZE_KEYS}
              />
              <ComboSelector value={comboCount} onChange={setComboCount} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Pagamento
            </span>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao-informado">Não informado</SelectItem>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(520px,1.4fr),minmax(320px,1fr),220px] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-[220px,1fr]">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Bairro
              </span>
              <DeliveryZoneCombobox
                options={deliveryZones}
                value={deliveryZoneId}
                onChange={setDeliveryZoneId}
                disabled={takeAway}
                placeholder="Selecionar bairro"
                className="w-full"
              />
              <label className="flex h-10 items-center gap-2 text-sm">
                <Switch
                  checked={takeAway}
                  onCheckedChange={(checked) => {
                    setTakeAway(checked);
                    if (checked) setDeliveryZoneId(null);
                  }}
                />
                Retirada
              </label>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Endereço
              </span>
              <Textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Endereço completo"
                rows={3}
                className="min-h-[84px] resize-y"
              />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Detalhe do pedido
            </span>
            <Textarea
              value={orderDetails}
              onChange={(event) => setOrderDetails(event.target.value)}
              placeholder="Sabores e detalhes do pedido"
              rows={3}
              className="min-h-[84px] resize-y"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 lg:pt-5">
            <label className="flex h-10 items-center gap-2 text-sm">
              <Switch
                checked={convertedToOrder}
                onCheckedChange={setConvertedToOrder}
              />
              Virou pedido
            </label>
            <Button
              type="submit"
              name="_intent"
              value="save"
              variant="outline"
              size="icon"
              disabled={busy}
              title="Salvar"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="submit"
              name="_intent"
              value="delete"
              variant="ghost"
              size="icon"
              disabled={busy}
              title="Excluir"
              className="text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </fetcher.Form>
      {fetcher.data?.error ? (
        <p className="mt-2 text-sm text-red-700">{fetcher.data.error}</p>
      ) : null}
    </div>
  );
}

function ReservationContent({
  reservations,
  deliveryZones,
}: {
  reservations: Reservation[];
  deliveryZones: Array<{ id: string; name: string }>;
}) {
  const totals = useMemo(() => {
    const sizes = defaultSizeCounts();
    let combos = 0;
    const neighborhoods = new Map<string, number>();

    reservations.forEach((reservation) => {
      const rowSizes = parseSizes(reservation.size);
      (Object.keys(sizes) as Array<keyof SizeCounts>).forEach((key) => {
        sizes[key] += rowSizes[key];
      });
      combos += reservation.comboCount;
      const neighborhood = reservation.takeAway
        ? "Retirada"
        : reservation.deliveryZone?.name ?? "Sem bairro";
      neighborhoods.set(
        neighborhood,
        (neighborhoods.get(neighborhood) ?? 0) + 1
      );
    });

    return {
      sizes,
      combos,
      totalPizzas:
        RESERVATION_SIZE_KEYS.reduce((sum, key) => sum + sizes[key], 0) +
        combos,
      neighborhoods: [...neighborhoods.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [reservations]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pizza className="h-4 w-4" /> Reservas por tamanho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-center">
              <div className="text-5xl font-black tabular-nums">
                {totals.totalPizzas}
              </div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                pizzas e combos
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {RESERVATION_SIZE_KEYS.map((key) => (
                <div
                  key={key}
                  className="rounded-lg border bg-slate-50 p-2 text-center"
                >
                  <div className="text-xs font-semibold uppercase text-slate-600">
                    {SIZE_LABELS[key]}
                  </div>
                  <div className="text-2xl font-bold tabular-nums">
                    {totals.sizes[key]}
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-2 text-center">
                <div className="text-xs font-semibold uppercase text-violet-700">
                  Combo
                </div>
                <div className="text-2xl font-bold tabular-nums text-violet-900">
                  {totals.combos}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reservas por bairro</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {totals.neighborhoods.length ? (
              totals.neighborhoods.map(([name, count]) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="gap-2 px-3 py-2 text-sm"
                >
                  {name}
                  <span className="font-bold tabular-nums">{count}</span>
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma reserva cadastrada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        {reservations.map((reservation, index) => (
          <div key={reservation.id}>
            {index > 0 ? <Separator className="my-6" /> : null}
            <ReservationRow
              reservation={reservation}
              deliveryZones={deliveryZones}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export default function MarketingPizzaReservationsPage() {
  const { campaigns, selectedCampaign, reservations, deliveryZones } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const addFetcher = useFetcher();

  return (
    <div className="space-y-6 p-4">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(320px,0.65fr)] lg:items-stretch">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Reservas de pizza</h1>
            <p className="text-sm text-muted-foreground">
              Reservas antecipadas por campanha de marketing.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-1 sm:max-w-md">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Campanha
              </span>
              <Select
                value={selectedCampaign?.key}
                onValueChange={(key) =>
                  navigate(`/admin/marketing/reservas-pizza/${key}`)
                }
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Selecionar campanha" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.key}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCampaign ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="h-11">
                  <a
                    href={`/admin/marketing/reservas-pizza/${selectedCampaign.key}?export=excel`}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Excel
                  </a>
                </Button>
                <addFetcher.Form method="post">
                  <input type="hidden" name="_intent" value="add" />
                  <Button
                    type="submit"
                    className="h-11 w-full sm:w-auto"
                    disabled={addFetcher.state !== "idle"}
                  >
                    {addFetcher.state !== "idle" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Adicionar reserva
                  </Button>
                </addFetcher.Form>
              </div>
            ) : null}
          </div>
        </div>

        {selectedCampaign ? (
          <div className="flex flex-col justify-center rounded-xl border bg-slate-50 px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campanha selecionada
            </div>
            <div className="mt-1 text-lg font-semibold">
              {selectedCampaign.name}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Vigência:{" "}
              {campaignPeriod(
                selectedCampaign.validFrom,
                selectedCampaign.validTo
              )}
            </div>
          </div>
        ) : null}
      </header>

      {selectedCampaign ? (
        <>
          <Suspense
            fallback={
              <div className="py-12 text-center text-muted-foreground">
                Carregando reservas...
              </div>
            }
          >
            <Await resolve={reservations}>
              {(rows) => (
                <ReservationContent
                  reservations={rows}
                  deliveryZones={deliveryZones}
                />
              )}
            </Await>
          </Suspense>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nenhuma campanha de reserva cadastrada.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
