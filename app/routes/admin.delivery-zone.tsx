// app/routes/admin.delivery-zones._index.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";


// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useEffect, useMemo, useRef, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";

// -------------------------
// Loader: lista + contagens
// -------------------------
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
    orderBy: [{ createdAt: "desc" }],
  });

  // Opcional: ID de uma zona "Não definido" se você criar uma no seed
  // Não é necessário para o requisito atual (vamos setar null no delete).
  return json({ zones, q });
}

// -------------------------
// Action: create/update/delete (com transação no delete)
// -------------------------
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

      if (!name || !city || !state) {
        return json(
          { ok: false, message: "Campos obrigatórios: nome, cidade e estado." },
          { status: 400 }
        );
      }

      const zone = await prisma.deliveryZone.create({
        data: { name, city, state, zipCode },
      });
      return json({ ok: true, zone });
    }

    if (intent === "update") {
      const id = String(formData.get("id") ?? "");
      const name = String(formData.get("name") ?? "").trim();
      const city = String(formData.get("city") ?? "").trim();
      const state = String(formData.get("state") ?? "").trim();
      const zipCodeRaw = formData.get("zipCode");
      const zipCode = zipCodeRaw ? String(zipCodeRaw).trim() : null;

      if (!id || !name || !city || !state) {
        return json(
          { ok: false, message: "Campos obrigatórios: id, nome, cidade e estado." },
          { status: 400 }
        );
      }

      const zone = await prisma.deliveryZone.update({
        where: { id },
        data: { name, city, state, zipCode },
      });
      return json({ ok: true, zone });
    }

    if (intent === "delete") {
      const id = String(formData.get("id") ?? "");
      if (!id) {
        return json({ ok: false, message: "ID é obrigatório." }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // 1) Apaga distances vinculados a essa zone
        await tx.deliveryZoneDistance.deleteMany({
          where: { deliveryZoneId: id },
        });

        // 2) Set deliveryZoneId = null nos KDS detalhes
        await tx.kdsDailyOrderDetail.updateMany({
          where: { deliveryZoneId: id },
          data: { deliveryZoneId: null },
        });

        // 3) Apaga a zone
        await tx.deliveryZone.delete({ where: { id } });
      });

      return json({ ok: true });
    }

    return json({ ok: false, message: "Intent inválido." }, { status: 400 });
  } catch (e: any) {
    return json({ ok: false, message: e?.message ?? "Erro inesperado" }, { status: 500 });
  }
}

// ---------
// Component
// ---------
type ZoneRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  zipCode: string | null;
  _count: {
    distances: number;
    deliveryFees: number;
    KdsDailyOrderDetail: number;
  };
};

export default function DeliveryZonesPage() {
  const { zones, q } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState(q ?? "");
  const fetcher = useFetcher<any>();
  const [openDialog, setOpenDialog] = useState<null | { mode: "create" } | { mode: "edit"; zone: ZoneRow }>(null);
  const [pendingDelete, setPendingDelete] = useState<null | ZoneRow>(null);

  // Estados do formulário
  const initialForm = useMemo(
    () => ({
      id: "",
      name: "",
      city: "",
      state: "",
      zipCode: "",
    }),
    []
  );
  const [form, setForm] = useState(initialForm);

  // Preenche form quando abre o editar
  useEffect(() => {
    if (openDialog && openDialog.mode === "edit") {
      const z = openDialog.zone;
      setForm({
        id: z.id,
        name: z.name ?? "",
        city: z.city ?? "",
        state: z.state ?? "",
        zipCode: z.zipCode ?? "",
      });
    } else if (openDialog && openDialog.mode === "create") {
      setForm(initialForm);
    }
  }, [openDialog, initialForm]);

  // Fecha dialog ao terminar a action com sucesso
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setOpenDialog(null);
      setPendingDelete(null);
    }
  }, [fetcher.state, fetcher.data]);

  // Helpers de submit
  function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("_intent", "create");
    fd.set("name", form.name);
    fd.set("city", form.city);
    fd.set("state", form.state);
    if (form.zipCode) fd.set("zipCode", form.zipCode);
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
    fetcher.submit(fd, { method: "post" });
  }

  function onConfirmDelete() {
    if (!pendingDelete) return;
    const fd = new FormData();
    fd.set("_intent", "delete");
    fd.set("id", pendingDelete.id);
    fetcher.submit(fd, { method: "post" });
  }

  // Filtro local (busca controlada pelo loader via query param)
  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    // Navegação via GET do fetcher para recarregar loader
    fetcher.submit(params, { method: "get", action: "/admin/delivery-zones" });
  }

  // Estados brasileiros comuns (opcional). Pode digitar livremente também.
  const brazilStates = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Delivery Zones</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie zonas de entrega. Ao excluir, as distâncias são removidas e os pedidos no KDS ficam sem zona (deliveryZoneId = null).
          </p>
        </div>

        <div className="flex gap-2">
          <form onSubmit={onSearchSubmit} className="flex gap-2">
            <Input
              placeholder="Buscar por nome, cidade, estado, CEP"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button type="submit" variant="secondary">Buscar</Button>
          </form>

          <Dialog open={!!openDialog && openDialog.mode === "create"} onOpenChange={(o) => setOpenDialog(o ? { mode: "create" } : null)}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpenDialog({ mode: "create" })}>Nova zona</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Criar Delivery Zone</DialogTitle>
                <DialogDescription>Preencha os campos obrigatórios.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmitCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Nome*</label>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="text-sm">Cidade*</label>
                    <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="text-sm">Estado*</label>
                    <Select
                      value={form.state}
                      onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilStates.map((uf) => (
                          <SelectItem value={uf} key={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm">CEP</label>
                    <Input value={form.zipCode} onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))} />
                  </div>
                </div>

                {fetcher.data?.ok === false && (
                  <p className="text-sm text-red-500">{fetcher.data.message ?? "Erro ao salvar."}</p>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>Cancelar</Button>
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
            {zones.length === 0 ? "Nenhuma zona encontrada" : `${zones.length} zona(s) encontrada(s)`}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead className="text-right">Distâncias</TableHead>
              <TableHead className="text-right">Taxas</TableHead>
              <TableHead className="text-right">Pedidos KDS</TableHead>
              <TableHead className="text-right w-[180px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((z: ZoneRow) => (
              <TableRow key={z.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{z.name}</TableCell>
                <TableCell>{z.city}</TableCell>
                <TableCell>{z.state}</TableCell>
                <TableCell>{z.zipCode ?? "—"}</TableCell>
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

      {/* Editar */}
      <Dialog
        open={!!openDialog && openDialog.mode === "edit"}
        onOpenChange={(o) => setOpenDialog(o ? openDialog : null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Editar Delivery Zone</DialogTitle>
            <DialogDescription>Atualize os campos obrigatórios.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmitUpdate} className="space-y-4">
            <input type="hidden" value={form.id} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Nome*</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm">Cidade*</label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm">Estado*</label>
                <Select
                  value={form.state}
                  onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brazilStates.map((uf) => (
                      <SelectItem value={uf} key={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">CEP</label>
                <Input
                  value={form.zipCode}
                  onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))}
                />
              </div>
            </div>

            {fetcher.data?.ok === false && (
              <p className="text-sm text-red-500">{fetcher.data.message ?? "Erro ao salvar."}</p>
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

      {/* Confirmar Exclusão */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => setPendingDelete(o ? pendingDelete : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir zona?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá <strong>remover</strong> as distâncias vinculadas e definir <code>deliveryZoneId = null</code> nos pedidos KDS relacionados.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {fetcher.data?.ok === false && (
            <p className="text-sm text-red-500">{fetcher.data.message ?? "Erro ao excluir."}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancelar</AlertDialogCancel>
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
