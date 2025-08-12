import { defer } from "@remix-run/node";
import {
  Await,
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
} from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import prismaClient from "~/lib/prisma/client.server";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircleIcon } from "lucide-react";
import { lastUrlSegment } from "~/utils/url";

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

  const selectedDate = params.date || data.today;

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

  return (
    <div>
      <Suspense fallback={<div>Carregando dias...</div>}>
        <Await resolve={data.days}>
          {(days) => (
            <div className="flex flex-col gap-0 ">
              {/* ===== Seletor de dias (mantido o layout/estilo) ===== */}
              <Tabs value={selectedDate}>
                <TabsList className="flex justify-start space-x-2 mb-4 overflow-x-auto md:max-w-6xl min-h-fit" >
                  {days.map((d: any) => {
                    const isSelected = d.localDateStr === selectedDate;
                    const isToday = d.localDateStr === data.today;
                    const isHoliday = d.isHoliday;

                    let tabClass =
                      "px-4 py-2 rounded transition-colors flex items-center space-x-1";
                    if (isSelected) {
                      tabClass += " bg-blue-600 text-white";
                    } else if (isHoliday) {
                      tabClass += " bg-red-200 text-red-800";
                    } else {
                      tabClass += " bg-gray-100 text-black";
                      if (isToday) tabClass += " font-semibold";
                    }

                    const dateObj = new Date(d.date);
                    const dayAbbr = dateObj
                      .toLocaleDateString("pt-BR", { weekday: "short" })
                      .replace(".", "");
                    const formattedDate = dateObj.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    });
                    const fullDate = dateObj.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    });

                    return (
                      <TabsTrigger key={d.id} value={d.localDateStr} asChild>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Preserva o modo atual (?mes=1) sem mudar o layout */}
                              <Link
                                to={`/admin/kds/atendimento/${d.localDateStr}${keepMonth}`}
                                className={tabClass}
                              >

                                {
                                  fullMonthUI ?
                                    <div className="flex flex-col gap-0">
                                      <span className="text-xs">{dayAbbr}</span>
                                      <span>{formattedDate}</span>
                                    </div> :
                                    <span>{dayAbbr}: {formattedDate}</span>
                                }
                                {isToday && (
                                  <span className="ml-1 text-[10px] bg-blue-200 text-blue-800 px-1 rounded">
                                    Hoje
                                  </span>
                                )}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{fullDate}</p>
                              {isHoliday && (
                                <p className="text-red-600 text-xs">Feriado</p>
                              )}
                              {isToday && (
                                <p className="text-blue-600 text-xs">Hoje</p>
                              )}
                              {/* Exemplo: usar o state SÓ para decisão visual (sem mudar layout) */}
                              {fullMonthUI && (
                                <p className="text-xs text-blue-700 mt-1">Modo mês</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
              {/* ===== Fim do seletor ===== */}

              {slug === "atendimento" && (
                <div className="flex gap-3 items-center">
                  <AlertCircleIcon />
                  <p>Selecionar uma data para começar</p>
                </div>
              )}

              <Outlet key={pathname} />
            </div>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
