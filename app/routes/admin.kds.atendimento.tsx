import { defer } from "@remix-run/node";
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
import { AlertCircleIcon, Grid3X3, RefreshCw, SquareKanban } from "lucide-react";
import { lastUrlSegment } from "~/utils/url";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "~/components/ui/separator";

/* =============================
 * Helpers de data
 * ============================= */
export function formatLocalDate(date: Date): string {
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
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const fullMonth = url.searchParams.get("mes") === "1";

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

  const normalizedDays = days.map((d) => ({
    ...d,
    localDateStr: formatLocalDate(new Date(d.date)),
  }));

  return defer({
    days: normalizedDays,
    today: todayStr,
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

  // Se não houver :date na URL, não define value -> mostra placeholder
  const selectedDateFromUrl = params.date;
  const selectedDate = selectedDateFromUrl || data.today;

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
      const index = data.days.findIndex((d: any) => d.localDateStr === selectedDate);
      if (index < data.days.length - 1) {
        navigate(`/admin/kds/atendimento/${data.days[index + 1].localDateStr}${keepMonth}`);
      }
    },
    [data.days, selectedDate, keepMonth]
  );

  useHotkeys(
    "ctrl+left",
    () => {
      const index = data.days.findIndex((d: any) => d.localDateStr === selectedDate);
      if (index > 0) {
        navigate(`/admin/kds/atendimento/${data.days[index - 1].localDateStr}${keepMonth}`);
      }
    },
    [data.days, selectedDate, keepMonth]
  );

  // Atalho "m" para alternar MÊS/Semana (dados: altera a URL)
  useHotkeys(
    "m",
    (e) => {
      e.preventDefault();
      const base = `/admin/kds/atendimento/${selectedDate}`;
      navigate(fullMonthFromUrl ? base : `${base}?mes=1`);
      // UI seguirá a URL pelo efeito acima
    },
    [fullMonthFromUrl, selectedDate]
  );

  const slug = lastUrlSegment(pathname);

  const { date } = useParams();
  const isKanban = pathname.endsWith("/kanban");
  const { revalidate, state } = useRevalidator();

  // Revalida a cada 5min
  useEffect(() => {
    const t = setInterval(() => revalidate(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [revalidate]);

  return (
    <div>
      <Suspense fallback={<div>Carregando dias...</div>}>
        <Await resolve={data.days}>
          {(days) => {
            // utilitários para rotular dias
            const todayEntry = (days as any[]).find((d) => d.localDateStr === data.today);
            const todayDateObj = todayEntry ? new Date(todayEntry.date) : new Date();

            const dd = String(todayDateObj.getDate()).padStart(2, "0");
            const mm = String(todayDateObj.getMonth() + 1).padStart(2, "0");
            const yyyy = todayDateObj.getFullYear();
            const todayItemLabel = `${dd}/${mm}/${yyyy} — dia de hoje`;

            const renderLabel = (d: any) => {
              const dateObj = new Date(d.date);
              const dayAbbr = dateObj
                .toLocaleDateString("pt-BR", { weekday: "short" })
                .replace(".", "");
              const formattedDate = dateObj.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              });
              return fullMonthUI
                ? `${formattedDate} (${dayAbbr})`
                : `${dayAbbr}: ${formattedDate}`;
            };

            return (
              <div className="flex flex-col gap-0 ">
                <div className="flex flex-wrap justify-between mb-6">
                  {/* ===== Seletor de dias (Select com placeholder) ===== */}

                  <div className="flex flex-row items-center gap-x-4" >

                    <Select
                      value={selectedDateFromUrl /* undefined => placeholder */}
                      onValueChange={(val) =>
                        navigate(`/admin/kds/atendimento/${val}${keepMonth}`)
                      }
                    >
                      <SelectTrigger className="w-[420px] h-12 text-base">
                        <SelectValue placeholder="Selecionar uma data" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[55vh]">
                        {/* Hoje em primeiro */}
                        <SelectItem value={data.today}>{todayItemLabel}</SelectItem>

                        {/* Separador visual */}
                        <div className="my-1 border-t" role="none" />

                        {/* Demais dias (exclui hoje) */}
                        {(days as any[])
                          .filter((d) => d.localDateStr !== data.today)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.localDateStr}>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>{renderLabel(d)}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {new Date(d.date).toLocaleDateString("pt-BR", {
                                        weekday: "long",
                                        day: "2-digit",
                                        month: "long",
                                        year: "numeric",
                                      })}
                                    </p>
                                    {d.isHoliday && (
                                      <p className="text-red-600 text-xs">Feriado</p>
                                    )}
                                    {d.localDateStr === data.today && (
                                      <p className="text-blue-600 text-xs">Hoje</p>
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
                    <Button size="sm" variant={"outline"} onClick={() => revalidate()} className="flex items-center gap-2" >
                      <span className="text-sm">Atualizar</span>
                      <RefreshCw
                        size={16}
                        className={`${state === "loading" ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </div>



                  {/* Toggle Planilha/Kanban */}
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant={isKanban ? "outline" : "default"}>
                      <Link to={`/admin/kds/atendimento/${date ?? data.today}`} className="flex items-center gap-2">
                        <span className="text-sm">Planinha</span>
                        <Grid3X3 size={16} />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant={isKanban ? "default" : "outline"}>
                      <Link to={`/admin/kds/atendimento/${date ?? data.today}/kanban`} className="flex items-center gap-2">
                        <span className="text-sm">Kanban</span>
                        <SquareKanban size={16} />
                      </Link>
                    </Button>
                  </div>


                </div>
                {/* ===== Fim do seletor ===== */}

                {lastUrlSegment(pathname) === "atendimento" && (
                  <div className="flex gap-3 items-center">
                    <AlertCircleIcon />
                    <p>Selecionar uma data para começar</p>
                  </div>
                )}

                <Outlet key={pathname} />
              </div>
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}
