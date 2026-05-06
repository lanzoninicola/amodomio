// app/routes/admin.delivery-zones._index.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BRAZIL_SOCIOECONOMIC_CLASSES,
  getBrazilSocioeconomicClass,
  type BrazilSocioeconomicClassCode,
} from "~/domain/campaigns/brazil-socioeconomic-class";
import prismaClient from "~/lib/prisma/client.server";

type ZoneRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  zipCode: string | null;
  audienceClasses: BrazilSocioeconomicClassCode[];
  _count: {
    distances: number;
    deliveryFees: number;
    KdsDailyOrderDetail: number;
  };
};

type ZoneFormState = {
  id: string;
  name: string;
  city: string;
  state: string;
  zipCode: string;
  audienceClasses: BrazilSocioeconomicClassCode[];
};

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function parseAudienceClasses(formData: FormData): BrazilSocioeconomicClassCode[] {
  const validCodes = new Set(
    BRAZIL_SOCIOECONOMIC_CLASSES.map((item) => item.code)
  );

  return formData
    .getAll("audienceClasses")
    .map((value) => String(value))
    .filter(
      (value, index, list): value is BrazilSocioeconomicClassCode =>
        validCodes.has(value as BrazilSocioeconomicClassCode) &&
        list.indexOf(value) === index
    );
}

async function updateDeliveryZoneAudienceClasses(
  zoneId: string,
  audienceClasses: BrazilSocioeconomicClassCode[]
) {
  await prismaClient.$executeRaw`
    UPDATE delivery_zones
    SET audience_classes = ${audienceClasses}::text[]
    WHERE id = ${zoneId}
  `;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const zones = await prismaClient.deliveryZone.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { state: { contains: q, mode: "insensitive" } },
            { zipCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      _count: {
        select: {
          distances: true,
          deliveryFees: true,
          KdsDailyOrderDetail: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const audienceRows = await prismaClient.$queryRaw<
    Array<{ id: string; audience_classes: string[] | null }>
  >`
    SELECT id, audience_classes
    FROM delivery_zones
  `;

  const audienceByZoneId = new Map(
    audienceRows.map((row) => [row.id, row.audience_classes ?? []])
  );

  return json({
    zones: zones.map((zone) => ({
      ...zone,
      audienceClasses: audienceByZoneId.get(zone.id) ?? [],
    })),
    q,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("_intent") ?? "");

  try {
    if (intent === "create") {
      const name = String(formData.get("name") ?? "").trim();
      const city = String(formData.get("city") ?? "").trim();
      const state = String(formData.get("state") ?? "").trim();
      const zipCodeRaw = formData.get("zipCode");
      const zipCode = zipCodeRaw ? String(zipCodeRaw).trim() : null;
      const audienceClasses = parseAudienceClasses(formData);

      if (!name || !city || !state) {
        return json(
          { ok: false, message: "Campos obrigatórios: nome, cidade e estado." },
          { status: 400 }
        );
      }

      const zone = await prismaClient.deliveryZone.create({
        data: { name, city, state, zipCode },
      });
      await updateDeliveryZoneAudienceClasses(zone.id, audienceClasses);
      return json({ ok: true, zone });
    }

    if (intent === "update") {
      const id = String(formData.get("id") ?? "");
      const name = String(formData.get("name") ?? "").trim();
      const city = String(formData.get("city") ?? "").trim();
      const state = String(formData.get("state") ?? "").trim();
      const zipCodeRaw = formData.get("zipCode");
      const zipCode = zipCodeRaw ? String(zipCodeRaw).trim() : null;
      const audienceClasses = parseAudienceClasses(formData);

      if (!id || !name || !city || !state) {
        return json(
          { ok: false, message: "Campos obrigatórios: id, nome, cidade e estado." },
          { status: 400 }
        );
      }

      const zone = await prismaClient.deliveryZone.update({
        where: { id },
        data: { name, city, state, zipCode },
      });
      await updateDeliveryZoneAudienceClasses(zone.id, audienceClasses);
      return json({ ok: true, zone });
    }

    if (intent === "updateAudienceClasses") {
      const id = String(formData.get("id") ?? "").trim();
      const audienceClasses = parseAudienceClasses(formData);

      if (!id) {
        return json({ ok: false, message: "ID é obrigatório." }, { status: 400 });
      }

      await updateDeliveryZoneAudienceClasses(id, audienceClasses);

      return json({ ok: true });
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (!id) {
        return json({ ok: false, message: "ID é obrigatório." }, { status: 400 });
      }

      await prismaClient.$transaction(async (tx) => {
        await tx.deliveryZoneDistance.deleteMany({
          where: { deliveryZoneId: id },
        });

        await tx.kdsDailyOrderDetail.updateMany({
          where: { deliveryZoneId: id },
          data: { deliveryZoneId: null },
        });

        await tx.deliveryZone.delete({ where: { id } });
      });

      return json({ ok: true });
    }

    return json({ ok: false, message: "Intent inválido." }, { status: 400 });
  } catch (e: any) {
    return json(
      { ok: false, message: e?.message ?? "Erro inesperado" },
      { status: 500 }
    );
  }
}

function toggleAudienceClass(
  audienceClasses: BrazilSocioeconomicClassCode[],
  code: BrazilSocioeconomicClassCode,
  checked: boolean
) {
  if (checked) {
    return [...audienceClasses, code].filter(
      (value, index, list) => list.indexOf(value) === index
    );
  }

  return audienceClasses.filter((value) => value !== code);
}

function AudienceClassesField({
  selectedClasses,
  onToggle,
  disabled = false,
  showSummary = true,
}: {
  selectedClasses: BrazilSocioeconomicClassCode[];
  onToggle: (code: BrazilSocioeconomicClassCode, checked: boolean) => void;
  disabled?: boolean;
  showSummary?: boolean;
}) {
  return (
    <div className="space-y-2">
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
        {BRAZIL_SOCIOECONOMIC_CLASSES.map((item) => (
          <Tooltip key={item.code}>
            <TooltipTrigger asChild>
              <label className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                <Checkbox
                  checked={selectedClasses.includes(item.code)}
                  onCheckedChange={(checked) => onToggle(item.code, checked === true)}
                  disabled={disabled}
                />
                <span>{item.code}</span>
              </label>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
              <div className="font-semibold">{item.code}</div>
              <div>Renda familiar: {item.familyIncomeRangeLabel} R$/mês</div>
              <div>Sensibilidade a preço: {item.priceSensitivity}</div>
              <div>Motivação principal: {item.purchaseMotivation}</div>
            </TooltipContent>
          </Tooltip>
        ))}
        </div>
      </TooltipProvider>

      {showSummary && selectedClasses.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {selectedClasses.map((code) => (
              <Badge key={code} variant="secondary">
                {code}
              </Badge>
            ))}
          </div>

          <div className="space-y-2">
            {selectedClasses.map((code) => {
              const audienceClass = getBrazilSocioeconomicClass(code);
              if (!audienceClass) return null;

              return (
                <div
                  key={code}
                  className="rounded-md border bg-muted/30 p-2 text-xs leading-relaxed"
                >
                  <div className="font-semibold">{audienceClass.code}</div>
                  <div>Renda familiar: {audienceClass.familyIncomeRangeLabel} R$/mês</div>
                  <div>Sensibilidade a preço: {audienceClass.priceSensitivity}</div>
                  <div>Motivação principal: {audienceClass.purchaseMotivation}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : showSummary ? (
        <p className="text-xs text-muted-foreground">
          Selecione uma ou mais classes para descrever o público da zona.
        </p>
      ) : null}
    </div>
  );
}

function AudienceClassesInlineTable({
  selectedClasses,
}: {
  selectedClasses: BrazilSocioeconomicClassCode[];
}) {
  if (selectedClasses.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma classe selecionada para esta zona.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-2 py-2 font-medium">Classe</th>
            <th className="px-2 py-2 font-medium">Renda familiar</th>
            <th className="px-2 py-2 font-medium">Sensibilidade</th>
            <th className="px-2 py-2 font-medium">Motivação</th>
          </tr>
        </thead>
        <tbody>
      {selectedClasses.map((code) => {
        const audienceClass = getBrazilSocioeconomicClass(code);
        if (!audienceClass) return null;

        return (
          <tr key={code} className="border-t align-top">
            <td className="px-2 py-2 font-medium">{audienceClass.code}</td>
            <td className="px-2 py-2">{audienceClass.familyIncomeRangeLabel} R$/mês</td>
            <td className="px-2 py-2">{audienceClass.priceSensitivity}</td>
            <td className="px-2 py-2">{audienceClass.purchaseMotivation}</td>
          </tr>
        );
      })}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryZoneAudienceCell({ zone }: { zone: ZoneRow }) {
  const fetcher = useFetcher<any>();
  const [selectedClasses, setSelectedClasses] = useState<BrazilSocioeconomicClassCode[]>(
    zone.audienceClasses ?? []
  );

  useEffect(() => {
    setSelectedClasses(zone.audienceClasses ?? []);
  }, [zone.audienceClasses]);

  function submitAudienceClasses(nextClasses: BrazilSocioeconomicClassCode[]) {
    const fd = new FormData();
    fd.set("_intent", "updateAudienceClasses");
    fd.set("id", zone.id);
    nextClasses.forEach((item) => fd.append("audienceClasses", item));
    fetcher.submit(fd, { method: "post" });
  }

  function onToggle(code: BrazilSocioeconomicClassCode, checked: boolean) {
    const nextClasses = toggleAudienceClass(selectedClasses, code, checked);
    setSelectedClasses(nextClasses);
    submitAudienceClasses(nextClasses);
  }

  return (
    <div className="min-w-[520px] space-y-2">
      <AudienceClassesField
        selectedClasses={selectedClasses}
        onToggle={onToggle}
        disabled={fetcher.state !== "idle"}
        showSummary={false}
      />

      <div className="flex flex-wrap gap-2">
        {selectedClasses.map((code) => (
          <Badge key={code} variant="secondary">
            {code}
          </Badge>
        ))}
      </div>

      <AudienceClassesInlineTable selectedClasses={selectedClasses} />

      <p className="text-[11px] text-muted-foreground">
        {fetcher.state === "submitting"
          ? "Salvando classes..."
          : fetcher.data?.ok === false
            ? fetcher.data.message ?? "Erro ao salvar classes."
            : "Alterações salvas automaticamente."}
      </p>
    </div>
  );
}

export default function DeliveryZonesPage() {
  const { zones, q } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState(q ?? "");
  const fetcher = useFetcher<any>();
  const [openDialog, setOpenDialog] = useState<
    null | { mode: "create" } | { mode: "edit"; zone: ZoneRow }
  >(null);
  const [pendingDelete, setPendingDelete] = useState<null | ZoneRow>(null);

  const initialForm = useMemo<ZoneFormState>(
    () => ({
      id: "",
      name: "",
      city: "",
      state: "",
      zipCode: "",
      audienceClasses: [],
    }),
    []
  );
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (openDialog && openDialog.mode === "edit") {
      const z = openDialog.zone;
      setForm({
        id: z.id,
        name: z.name ?? "",
        city: z.city ?? "",
        state: z.state ?? "",
        zipCode: z.zipCode ?? "",
        audienceClasses: z.audienceClasses ?? [],
      });
    } else if (openDialog && openDialog.mode === "create") {
      setForm(initialForm);
    }
  }, [openDialog, initialForm]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setOpenDialog(null);
      setPendingDelete(null);
    }
  }, [fetcher.state, fetcher.data]);

  function appendAudienceClasses(fd: FormData) {
    form.audienceClasses.forEach((item) => fd.append("audienceClasses", item));
  }

  function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("_intent", "create");
    fd.set("name", form.name);
    fd.set("city", form.city);
    fd.set("state", form.state);
    if (form.zipCode) fd.set("zipCode", form.zipCode);
    appendAudienceClasses(fd);
    fetcher.submit(fd, { method: "post" });
  }

  function onSubmitUpdate(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("_intent", "update");
    fd.set("id", form.id);
    fd.set("name", form.name);
    fd.set("city", form.city);
    fd.set("state", form.state);
    if (form.zipCode) fd.set("zipCode", form.zipCode);
    else fd.set("zipCode", "");
    appendAudienceClasses(fd);
    fetcher.submit(fd, { method: "post" });
  }

  function onConfirmDelete() {
    if (!pendingDelete) return;
    const fd = new FormData();
    fd.set("_intent", "delete");
    fd.set("id", pendingDelete.id);
    fetcher.submit(fd, { method: "post" });
  }

  function onToggleFormAudienceClass(
    code: BrazilSocioeconomicClassCode,
    checked: boolean
  ) {
    setForm((current) => ({
      ...current,
      audienceClasses: toggleAudienceClass(current.audienceClasses, code, checked),
    }));
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Delivery Zones</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie zonas de entrega. Ao excluir, as distâncias são removidas e os
            pedidos no KDS ficam sem zona (`deliveryZoneId = null`).
          </p>
        </div>

        <div className="flex gap-2">
          <form method="get" action="/admin/delivery-zone" className="flex gap-2">
            <Input
              name="q"
              placeholder="Buscar por nome, cidade, estado, CEP"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>

          <Dialog
            open={!!openDialog && openDialog.mode === "create"}
            onOpenChange={(open) => setOpenDialog(open ? { mode: "create" } : null)}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setOpenDialog({ mode: "create" })}>
                Nova zona
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px]">
              <DialogHeader>
                <DialogTitle>Criar Delivery Zone</DialogTitle>
                <DialogDescription>Preencha os campos obrigatórios.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmitCreate} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm">Nome*</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm">Cidade*</label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm">Estado*</label>
                    <Select
                      value={form.state}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, state: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZIL_STATES.map((uf) => (
                          <SelectItem value={uf} key={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm">CEP</label>
                    <Input
                      value={form.zipCode}
                      onChange={(e) => setForm((current) => ({ ...current, zipCode: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Classes de público da zona</label>
                  <AudienceClassesField
                    selectedClasses={form.audienceClasses}
                    onToggle={onToggleFormAudienceClass}
                    disabled={fetcher.state !== "idle"}
                  />
                </div>

                {fetcher.data?.ok === false && (
                  <p className="text-sm text-red-500">
                    {fetcher.data.message ?? "Erro ao salvar."}
                  </p>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={fetcher.state !== "idle"}>
                    {fetcher.state === "submitting" ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="rounded-xl border">
        <Table>
          <TableCaption>
            {zones.length === 0
              ? "Nenhuma zona encontrada"
              : `${zones.length} zona(s) encontrada(s)`}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Público da zona</TableHead>
              <TableHead className="text-right">Distâncias</TableHead>
              <TableHead className="text-right">Taxas</TableHead>
              <TableHead className="text-right">Pedidos KDS</TableHead>
              <TableHead className="w-[180px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((z: ZoneRow) => (
              <TableRow key={z.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{z.name}</TableCell>
                <TableCell>{z.city}</TableCell>
                <TableCell>{z.state}</TableCell>
                <TableCell>{z.zipCode ?? "—"}</TableCell>
                <TableCell>
                  <DeliveryZoneAudienceCell zone={z} />
                </TableCell>
                <TableCell className="text-right">{z._count.distances}</TableCell>
                <TableCell className="text-right">{z._count.deliveryFees}</TableCell>
                <TableCell className="text-right">{z._count.KdsDailyOrderDetail}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setOpenDialog({ mode: "edit", zone: z })}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setPendingDelete(z)}
                    >
                      Excluir
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Dialog
        open={!!openDialog && openDialog.mode === "edit"}
        onOpenChange={(open) => setOpenDialog(open ? openDialog : null)}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Editar Delivery Zone</DialogTitle>
            <DialogDescription>Atualize os campos obrigatórios.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmitUpdate} className="space-y-4">
            <input type="hidden" value={form.id} readOnly />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm">Nome*</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm">Cidade*</label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm">Estado*</label>
                <Select
                  value={form.state}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, state: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZIL_STATES.map((uf) => (
                      <SelectItem value={uf} key={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">CEP</label>
                <Input
                  value={form.zipCode}
                  onChange={(e) => setForm((current) => ({ ...current, zipCode: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Classes de público da zona</label>
              <AudienceClassesField
                selectedClasses={form.audienceClasses}
                onToggle={onToggleFormAudienceClass}
                disabled={fetcher.state !== "idle"}
              />
            </div>

            {fetcher.data?.ok === false && (
              <p className="text-sm text-red-500">
                {fetcher.data.message ?? "Erro ao salvar."}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={fetcher.state !== "idle"}>
                {fetcher.state === "submitting" ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => setPendingDelete(open ? pendingDelete : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir zona?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá <strong>remover</strong> as distâncias vinculadas e definir{" "}
              <code>deliveryZoneId = null</code> nos pedidos KDS relacionados.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {fetcher.data?.ok === false && (
            <p className="text-sm text-red-500">
              {fetcher.data.message ?? "Erro ao excluir."}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              disabled={fetcher.state !== "idle"}
            >
              {fetcher.state === "submitting" ? "Excluindo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
