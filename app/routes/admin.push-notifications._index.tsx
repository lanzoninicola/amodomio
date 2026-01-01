import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { useMemo } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
<<<<<<< Updated upstream
import { sendCampaignNow } from "~/domain/push/web-push.server";
=======
import { getRecentPushErrors, sendCampaignNow } from "~/domain/push/web-push.server";
>>>>>>> Stashed changes

type Campaign = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  status: string;
  sendCount: number;
  showCount: number;
  clickCount: number;
  sentAt: Date | null;
  createdAt: Date;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const totalSubscriptions = await prismaClient.pushSubscription.count();
  const hasVapidKeys = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const sort = url.searchParams.get("sort") ?? "created_desc";
  const search = url.searchParams.get("search") ?? "";
  const flash = {
    sent: url.searchParams.get("sent") ?? "",
    saved: url.searchParams.get("saved") ?? "",
  };

  const where: any = {};
  if (status !== "all") where.status = status;
  if (search) where.title = { contains: search, mode: "insensitive" };

  const orderBy =
    sort === "created_asc"
      ? { createdAt: "asc" }
      : sort === "send_desc"
      ? { sendCount: "desc" }
      : sort === "show_desc"
      ? { showCount: "desc" }
      : sort === "click_desc"
      ? { clickCount: "desc" }
      : { createdAt: "desc" };

  const campaigns = await prismaClient.pushNotificationCampaign.findMany({
    where,
    orderBy,
    take: 50,
  });

<<<<<<< Updated upstream
  return json({ totalSubscriptions, hasVapidKeys, campaigns, flash });
=======
  const recentErrors = getRecentPushErrors();

  return json({ totalSubscriptions, hasVapidKeys, campaigns, flash, recentErrors });
>>>>>>> Stashed changes
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = (formData.get("intent") || "").toString();

  if (intent === "send-existing") {
    const campaignId = (formData.get("campaignId") || "").toString();
    if (!campaignId) return json({ error: "Campanha não informada." }, { status: 400 });
    try {
      await sendCampaignNow(campaignId);
      return redirect("/admin/push-notifications?sent=1");
    } catch (error: any) {
      return json({ error: error?.message || "Erro ao enviar notificações." }, { status: 500 });
    }
  }

  return json({ error: "Ação não suportada." }, { status: 400 });
}

export default function AdminPushNotificationsIndex() {
<<<<<<< Updated upstream
  const { totalSubscriptions, hasVapidKeys, campaigns, flash } = useLoaderData<typeof loader>();
=======
  const { totalSubscriptions, hasVapidKeys, campaigns, flash, recentErrors } = useLoaderData<typeof loader>();
>>>>>>> Stashed changes
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();

  const isSubmittingSendExisting = useMemo(
    () => navigation.state === "submitting" && navigation.formData?.get("intent") === "send-existing",
    [navigation]
  );

  const filters = {
    status: searchParams.get("status") ?? "all",
    sort: searchParams.get("sort") ?? "created_desc",
    search: searchParams.get("search") ?? "",
  };

  const handleFilterChange = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notificações (Web Push)</h1>
          <p className="text-sm text-muted-foreground">
            Apenas usuários públicos (cardápio) receberão. Subscrições atuais: {totalSubscriptions}.
          </p>
          {!hasVapidKeys && (
            <p className="text-sm text-red-600 mt-2">
              VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes. Configure antes de enviar.
            </p>
          )}
        </div>
        <Link to="/admin/push-notifications/new">
          <Button className="shadow-sm">Nova campanha</Button>
        </Link>
      </div>

      <SummaryGrid campaigns={campaigns} subscriptions={totalSubscriptions} />

      <div className="border rounded-xl p-4 bg-white shadow-sm">
        <div className="grid gap-3 md:grid-cols-[180px_220px_1fr] items-end">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(v) => handleFilterChange("status", v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Ordenar por</Label>
            <Select
              value={filters.sort}
              onValueChange={(v) => handleFilterChange("sort", v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Criado (recente)</SelectItem>
                <SelectItem value="created_asc">Criado (antigo)</SelectItem>
                <SelectItem value="send_desc">Envios (maior)</SelectItem>
                <SelectItem value="show_desc">Visualizações (maior)</SelectItem>
                <SelectItem value="click_desc">Cliques (maior)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Busca</Label>
            <Input
              name="search"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              placeholder="Título contém..."
              className="h-10"
            />
          </div>
        </div>
      </div>

      {flash.sent && <div className="text-sm text-green-700">Campanha enviada.</div>}
      {flash.saved && <div className="text-sm text-green-700">Campanha salva para depois.</div>}
<<<<<<< Updated upstream
=======
      {recentErrors?.length ? (
        <div className="border rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-lg font-semibold">Falhas recentes</h2>
            <div className="text-xs text-slate-500">Últimas {recentErrors.length} tentativas com erro</div>
          </div>
          <div className="divide-y">
            {recentErrors.map((err) => (
              <div key={`${err.campaignId}-${err.endpoint}-${err.at}`} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-semibold">Campanha: {err.campaignId}</span>
                    <span className="text-xs text-slate-500 break-all">{err.endpoint}</span>
                  </div>
                  <Badge variant={err.provider === "apple" ? "destructive" : "secondary"}>
                    {err.provider || "erro"}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {err.statusCode ? `HTTP ${err.statusCode}` : "Erro desconhecido"} — {err.reason || "Sem detalhes"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
>>>>>>> Stashed changes

      <div className="border rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-semibold">Campanhas</h2>
          <div className="text-xs text-slate-500">Total: {campaigns.length}</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-4"></TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Envios</TableHead>
              <TableHead className="hidden md:table-cell">Vistas</TableHead>
              <TableHead className="hidden md:table-cell">Cliques</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="w-4">
                  <span className="text-slate-300">⋮⋮</span>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-sm">{c.title}</div>
                  {c.body && (
                    <div className="text-xs text-slate-500 line-clamp-2 mt-1">“{c.body.slice(0, 120)}...”</div>
                  )}
                  <div className="text-[11px] text-slate-400 mt-1">
                    {c.sentAt ? `Enviado em ${new Date(c.sentAt).toLocaleString()}` : "Não enviado"}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StatusPill status={c.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">{c.sendCount}</TableCell>
                <TableCell className="hidden md:table-cell">{c.showCount}</TableCell>
                <TableCell className="hidden md:table-cell">{c.clickCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Form method="post">
                      <input type="hidden" name="campaignId" value={c.id} />
                      <Button
                        name="intent"
                        value="send-existing"
                        type="submit"
                        size="sm"
                        disabled={!hasVapidKeys || isSubmittingSendExisting}
                        variant={c.status === "sent" ? "secondary" : "default"}
                      >
                        {isSubmittingSendExisting ? "..." : "Enviar"}
                      </Button>
                    </Form>
                    <Link to={`/admin/push-notifications/new?clone=${c.id}`}>
                      <Button variant="ghost" size="sm">
                        Clonar
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6">
                  Nenhuma campanha criada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "outline",
    scheduled: "secondary",
    sent: "default",
  };
  const variant = map[status] ?? "outline";
  const label = status === "sent" ? "Enviada" : status === "scheduled" ? "Agendada" : "Rascunho";
  return <Badge variant={variant as any}>{label}</Badge>;
}

type ProgressProps = { label: string; current: number; total: number; color: string };
function SummaryGrid({ campaigns, subscriptions }: { campaigns: Campaign[]; subscriptions: number }) {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.sent += c.sendCount;
      acc.views += c.showCount;
      acc.clicks += c.clickCount;
      return acc;
    },
    { sent: 0, views: 0, clicks: 0 }
  );

  const cards = [
    { label: "Subscrições", value: subscriptions, helper: "Apenas cardápio", accent: "text-indigo-700" },
    { label: "Envios", value: totals.sent, helper: "Total campanhas", accent: "text-emerald-700" },
    { label: "Visualizações", value: totals.views, helper: "Shows", accent: "text-slate-700" },
    { label: "Cliques", value: totals.clicks, helper: "Engajamento", accent: "text-amber-700" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="border rounded-xl p-3 bg-white shadow-sm">
          <p className="text-xs uppercase font-semibold text-slate-500">{card.label}</p>
          <p className={`text-2xl font-bold ${card.accent}`}>{card.value}</p>
          <p className="text-[11px] text-slate-500">{card.helper}</p>
        </div>
      ))}
    </div>
  );
}
