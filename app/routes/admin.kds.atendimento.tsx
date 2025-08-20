import { defer, LoaderFunctionArgs } from "@remix-run/node";
import {
  Await,
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useRevalidator,
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
import { BarChart3, Grid3X3, RefreshCw, SquareKanban } from "lucide-react";
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
  const params = useParams();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  // Se não houver :date na URL, Select mostra placeholder
  const selectedDateFromUrl = params.date;

  // URL é a fonte de verdade para DADOS
  const fullMonthFromUrl = new URLSearchParams(search).get("mes") === "1";
  const keepMonth = fullMonthFromUrl ? "?mes=1" : "";

  // State SÓ para UI (espelha a URL)
  const [fullMonthUI, setFullMonthUI] = useState<boolean>(fullMonthFromUrl);
  useEffect(() => setFullMonthUI(fullMonthFromUrl), [fullMonthFromUrl]);

  // Atalhos Ctrl+→ e Ctrl+← (preservando ?mes=1)
  useHotkeys(
    "ctrl+right",
    () => {
      const index = data.days.findIndex((d: any) => d.ymd === (selectedDateFromUrl ?? ""));
      if (index >= 0 && index < data.days.length - 1) {
        navigate(`/admin/kds/atendimento/${(data.days as any[])[index + 1].ymd}/grid${keepMonth}`);
      }
    },
    [data.days, selectedDateFromUrl, keepMonth]
  );

  useHotkeys(
    "ctrl+left",
    () => {
      const index = data.days.findIndex((d: any) => d.ymd === (selectedDateFromUrl ?? ""));
      if (index > 0) {
        navigate(`/admin/kds/atendimento/${(data.days as any[])[index - 1].ymd}/grid${keepMonth}`);
      }
    },
    [data.days, selectedDateFromUrl, keepMonth]
  );

  // Atalho "m" para alternar MÊS/Semana (dados: altera a URL)
  useHotkeys(
    "m",
    (e) => {
      e.preventDefault();
      const base = `/admin/kds/atendimento/${selectedDateFromUrl ?? localTodayYMD()}/grid`;
      navigate(fullMonthFromUrl ? base : `${base}?mes=1`);
    },
    [fullMonthFromUrl, selectedDateFromUrl]
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
            <div className="flex flex-col gap-0 ">
              <div className="flex flex-wrap justify-between mb-6">
                {/* ===== Seletor de dias (Select com placeholder) ===== */}
                <div className="flex flex-row items-center gap-x-4">
                  <Select
                    value={selectedDateFromUrl /* undefined => placeholder */}
                    onValueChange={(val) =>
                      navigate(`/admin/kds/atendimento/${val}/grid${keepMonth}`)
                    }
                  >
                    <SelectTrigger className="w-[420px] h-12 text-base">
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
                                    <p className="text-xs text-blue-700 mt-1">Modo mês</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {/* Refresh */}
                  <Button
                    size="sm"
                    variant={"outline"}
                    onClick={() => revalidate()}
                    className={
                      cn(
                        "flex flex-row gap-2",
                        state === "loading" && "bg-blue-100"
                      )
                    }
                  >
                    <span className="text-sm">
                      {`${state === "loading" ? "Atualizando..." : "Atualizar"}`}
                    </span>
                    <RefreshCw
                      size={16}
                      className={`${state === "loading" ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>

                {/* Toggle Planilha/Kanban */}
                <div className="flex gap-2">
                  <Button asChild size="sm" variant={isKanban ? "outline" : "default"}>
                    <Link
                      to={`/admin/kds/atendimento/${date ?? clientTodayYMD}/grid`}
                      className="flex items-center gap-2"
                    >
                      <span className="text-sm">Planilha</span>
                      <Grid3X3 size={16} />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant={isKanban ? "default" : "outline"}>
                    <Link
                      to={`/admin/kds/atendimento/${date ?? clientTodayYMD}/kanban`}
                      className="flex items-center gap-2"
                    >
                      <span className="text-sm">Kanban</span>
                      <SquareKanban size={16} />
                    </Link>
                  </Button>
                  {/* Link para Relatório */}
                  <Button asChild size="sm" variant="secondary">
                    <Link to={`/admin/kds/atendimento/${selectedDateFromUrl}/relatorio`} className="ml-auto">
                      <BarChart3 className="w-4 h-4 mr-2" /> Relatório
                    </Link>
                  </Button>
                </div>
              </div>

              <Outlet key={pathname} />
            </div>
          )}
        </Await>
      </Suspense>
    </div>
  );
}