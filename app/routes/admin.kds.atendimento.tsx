import { defer, LoaderFunctionArgs } from "@remix-run/node";
import {
  Await,
  useFetcher,
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useRevalidator,
  useNavigation,
} from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BarChart3, Grid3X3, RefreshCw, SquareKanban, Loader2, MessageSquareText, Settings2, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "~/lib/utils";
import { todayLocalYMD } from "~/domain/kds";
import { Badge } from "@/components/ui/badge";
import { Separator } from "~/components/ui/separator";

/* =============================
 * Helpers de data
 * ============================= */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/* =============================
 * Loader — dados
 * - Se ?mes=1: mês corrente completo
 * - Caso contrário: janela curta (−5 / +3 dias)
 * ============================= */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const fullMonth = url.searchParams.get("mes") === "1";
  const dateStr = params.date ?? todayLocalYMD();

  const today = new Date();
  const todayStr = formatLocalDate(today);

  let start: Date;
  let end: Date;

  if (fullMonth) {
    start = startOfMonth(today);
    end = endOfMonth(today);
  } else {
    start = new Date(today);
    start.setDate(start.getDate() - 5);
    end = new Date(today);
    end.setDate(end.getDate() + 3);
  }

  const days = await prismaClient.calendarDay.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  // chave estável para navegação (UTC) + mantém o date original para rótulos
  const normalizedDays = days.map((d) => ({
    ...d,
    ymd: new Date(d.date).toISOString().slice(0, 10), // YYYY-MM-DD estável
  }));

  return defer({
    dateStr,
    days: normalizedDays,
    today: todayStr, // não é usada como value; mantida por compat.
    fullMonth, // modo atual (dados)
  });
}

/* =============================
 * Componente — UI
 * ============================= */
export default function KdsAtendimento() {
  const data = useLoaderData<typeof loader>();
  const reportFx = useFetcher<{ ok: boolean; error?: string; report?: { detail: string } }>();
  const params = useParams();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const navigation = useNavigation();
  const isRouteLoading = navigation.state !== "idle";

  // Se não houver :date na URL, Select mostra placeholder
  const selectedDateFromUrl = params.date;

  // URL é a fonte de verdade para DADOS
  const fullMonthFromUrl = new URLSearchParams(search).get("mes") === "1";
  const keepMonth = fullMonthFromUrl ? "?mes=1" : "";
  const currentVisualization = pathname.endsWith("/kanban") ? "kanban" : "grid";

  // State SÓ para UI (espelha a URL)
  const [fullMonthUI, setFullMonthUI] = useState<boolean>(fullMonthFromUrl);
  useEffect(() => setFullMonthUI(fullMonthFromUrl), [fullMonthFromUrl]);

  // Atalhos Ctrl+→ e Ctrl+← (preservando ?mes=1)
  useHotkeys(
    "ctrl+right",
    () => {
      const index = (data.days as any[]).findIndex((d: any) => d.ymd === (selectedDateFromUrl ?? ""));
      if (index >= 0 && index < (data.days as any[]).length - 1) {
        navigate(`/admin/kds/atendimento/${(data.days as any[])[index + 1].ymd}/${currentVisualization}${keepMonth}`);
      }
    },
    [currentVisualization, data.days, selectedDateFromUrl, keepMonth]
  );

  useHotkeys(
    "ctrl+left",
    () => {
      const index = (data.days as any[]).findIndex((d: any) => d.ymd === (selectedDateFromUrl ?? ""));
      if (index > 0) {
        navigate(`/admin/kds/atendimento/${(data.days as any[])[index - 1].ymd}/${currentVisualization}${keepMonth}`);
      }
    },
    [currentVisualization, data.days, selectedDateFromUrl, keepMonth]
  );

  // Atalho "m" para alternar MÊS/Semana (dados: altera a URL)
  useHotkeys(
    "m",
    (e) => {
      e.preventDefault();
      const base = `/admin/kds/atendimento/${selectedDateFromUrl ?? localTodayYMD()}/${currentVisualization}`;
      navigate(fullMonthFromUrl ? base : `${base}?mes=1`);
    },
    [currentVisualization, fullMonthFromUrl, selectedDateFromUrl]
  );

  const { date } = useParams();
  const isKanban = pathname.endsWith("/kanban");
  const { revalidate, state } = useRevalidator();

  // Revalida a cada 5min
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  // Helpers de label no fuso do cliente
  function localTodayYMD() {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const clientTodayYMD = localTodayYMD();
  const clientTodayLabel =
    new Date(`${clientTodayYMD}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) + " — dia de hoje";

  const renderLabel = (ymd: string) => {
    const dateObj = new Date(`${ymd}T12:00:00`); // DST-safe
    const dayAbbr = dateObj
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .replace(".", "");
    const formattedDate = dateObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    return fullMonthUI ? `${formattedDate} (${dayAbbr})` : `${dayAbbr}: ${formattedDate}`;
  };

  return (
    <div className="mb-12">
      <Suspense fallback={<div>Carregando dias...</div>}>
        <Await resolve={data.days}>
          {(days) => (
            <div className="flex flex-col gap-6">
              <Separator />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* ===== Bloco de data e ações ===== */}
                <div className="w-full space-y-4 lg:max-w-3xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold tracking-widest text-white shadow-sm">
                        KDS
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">Painel de atendimento</p>
                        <p className="text-xs text-slate-500">
                          {fullMonthUI ? "Período do mês completo" : "Janela de 8 dias (−5 / +3)"}
                          {` • ${days.length} dias carregados`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white/70 text-xs font-semibold text-slate-700">
                      {fullMonthUI ? "Modo mês" : "Modo semana"}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex flex-1 items-center gap-3">
                        <Select
                          value={selectedDateFromUrl /* undefined => placeholder */}
                          onValueChange={(val) =>
                            navigate(`/admin/kds/atendimento/${val}/${currentVisualization}${keepMonth}`)
                          }
                        >
                          <SelectTrigger className={cn("h-12 w-full rounded-lg border-slate-200 bg-white text-base shadow-sm", isRouteLoading && "ring-2 ring-blue-200")}>
                            <SelectValue placeholder="Selecionar uma data" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[55vh]">
                            {/* Hoje (cliente) em primeiro */}
                            <SelectItem value={clientTodayYMD}>{clientTodayLabel}</SelectItem>

                            {/* Separador visual */}
                            <div className="my-1 border-t" role="none" />

                            {/* Demais dias (exclui hoje do cliente) */}
                            {(days as any[])
                              .filter((d) => d.ymd !== clientTodayYMD)
                              .map((d) => (
                                <SelectItem key={d.id} value={d.ymd}>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>{renderLabel(d.ymd)}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          {new Date(`${d.ymd}T12:00:00`).toLocaleDateString("pt-BR", {
                                            weekday: "long",
                                            day: "2-digit",
                                            month: "long",
                                            year: "numeric",
                                          })}
                                        </p>
                                        {d.isHoliday && (
                                          <p className="text-red-600 text-xs">Feriado</p>
                                        )}
                                        {fullMonthUI && (
                                          <p className="mt-1 text-xs text-blue-700">Modo mês</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        {/* Spinner sutil quando navegando */}
                        {isRouteLoading && (
                          <Loader2
                            className="h-4 w-4 animate-spin text-blue-700"
                            aria-label="Carregando dia..."
                          />
                        )}
                      </div>

                      {/* Refresh */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={"outline"}
                              onClick={() => revalidate()}
                              className={cn(
                                "h-12 gap-2 rounded-lg border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-50",
                                state === "loading" && "bg-blue-50"
                              )}
                            >
                              {`${state === "loading" ? "Atualizando..." : "Atualizar"}`}
                              <RefreshCw size={16} className={`${state === "loading" ? "animate-spin" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Forçar atualização das informações</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>


                  </div>
                </div>

                <div className="w-full lg:max-w-sm">
                  <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] animate-pulse" />
                        <p className="text-sm font-semibold text-slate-800">Visualização</p>
                      </div>
                      <p className="text-xs text-slate-500">Planilha ou Kanban</p>
                    </div>

                    {selectedDateFromUrl ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          asChild
                          size="sm"
                          variant={isKanban ? "outline" : "default"}
                          className={cn(
                            "h-11 w-full justify-center rounded-lg text-sm font-semibold",
                            isKanban
                              ? "border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
                              : "bg-slate-900 text-white shadow-sm hover:bg-slate-900/90"
                          )}
                        >
                          <Link
                            to={`/admin/kds/atendimento/${date ?? clientTodayYMD}/grid${keepMonth}`}
                            prefetch="intent"
                            className="flex items-center justify-center gap-2"
                          >
                            <span>Planilha</span>
                            <Grid3X3 size={16} />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant={isKanban ? "default" : "outline"}
                          className={cn(
                            "h-11 w-full justify-center rounded-lg text-sm font-semibold",
                            isKanban
                              ? "bg-slate-900 text-white shadow-sm hover:bg-slate-900/90"
                              : "border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
                          )}
                        >
                          <Link
                            to={`/admin/kds/atendimento/${date ?? clientTodayYMD}/kanban${keepMonth}`}
                            prefetch="intent"
                            className="flex items-center justify-center gap-2"
                          >
                            <span>Kanban</span>
                            <SquareKanban size={16} />
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        Escolha uma data para habilitar as visualizações.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-0 ">
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 lg:flex-row lg:items-center lg:gap-3 lg:border-0 lg:bg-transparent lg:px-2 lg:py-0">

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-9 justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-none hover:bg-slate-100"
                    >
                      <Link
                        to={`/admin/kds/atendimento/${selectedDateFromUrl}/relatorio`}
                        prefetch="intent"
                        className="flex items-center justify-center gap-2"
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-sm font-medium">Relatório</span>
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-9 justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-none hover:bg-slate-100"
                    >
                      <Link
                        to={`/admin/kds/atendimento/${selectedDateFromUrl}/relatorio-mes`}
                        prefetch="intent"
                        className="flex items-center justify-center gap-2"
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-sm font-medium">Relatório Mensal</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="hidden h-10 w-px bg-slate-200 lg:mx-2 lg:block" />

                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 lg:flex-row lg:items-center lg:gap-3 lg:border-0 lg:bg-transparent lg:px-2 lg:py-0">

                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="h-9 justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-none hover:bg-slate-100"
                  >
                    <Link
                      to={`/admin/kds/atendimento/${selectedDateFromUrl}/estoque-massa`}
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      Estoque de massa
                    </Link>
                  </Button>
                </div>

                <div className="hidden h-10 w-px bg-slate-200 lg:mx-2 lg:block" />

                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 lg:flex-row lg:items-center lg:gap-3 lg:border-0 lg:bg-transparent lg:px-2 lg:py-0">

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
                    <reportFx.Form
                      method="post"
                      action={selectedDateFromUrl ? `/admin/kds/atendimento/${selectedDateFromUrl}/grid` : undefined}
                    >
                      <input type="hidden" name="_action" value="sendDayReportWhatsapp" />
                      <input type="hidden" name="date" value={selectedDateFromUrl ?? ""} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        disabled={!selectedDateFromUrl || reportFx.state !== "idle"}
                        className="h-9 w-full justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-none hover:bg-slate-100"
                      >
                        <span className="text-sm font-medium">
                          {reportFx.state !== "idle" ? "Enviando..." : "Relatorio WhatsApp"}
                        </span>
                      </Button>
                    </reportFx.Form>

                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-9 justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-none hover:bg-slate-100"
                    >
                      <Link
                        to="/admin/administracao/settings?context=kds-daily-report-whatsapp"
                        className="inline-flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <Settings2 className="h-4 w-4" />
                        Configurar relatorio
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sem key para não desmontar/remontar a cada navegação */}
              <Outlet />
            </div>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
