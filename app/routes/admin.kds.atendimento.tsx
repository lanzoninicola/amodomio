import { defer } from "@remix-run/node";
import { Await, Link, Outlet, useLoaderData, useLocation, useNavigate, useParams } from "@remix-run/react";
import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import prismaClient from "~/lib/prisma/client.server";
import { useHotkeys } from "react-hotkeys-hook";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function loader() {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  const start = new Date(today);
  start.setDate(start.getDate() - 5);
  const end = new Date(today);
  end.setDate(end.getDate() + 3);

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
  });
}

export default function KdsAtendimentoIndex() {
  const data = useLoaderData<typeof loader>();
  const params = useParams();
  const navigate = useNavigate();

  const selectedDate = params.date || data.today;

  // Atalhos Ctrl+→ e Ctrl+←
  useHotkeys("ctrl+right", () => {
    const index = data.days.findIndex((d: any) => d.localDateStr === selectedDate);
    if (index < data.days.length - 1) {
      navigate(`/admin/kds/atendimento/${data.days[index + 1].localDateStr}`);
    }
  });

  useHotkeys("ctrl+left", () => {
    const index = data.days.findIndex((d: any) => d.localDateStr === selectedDate);
    if (index > 0) {
      navigate(`/admin/kds/atendimento/${data.days[index - 1].localDateStr}`);
    }
  });

  const { pathname } = useLocation()

  return (
    <div>
      <Suspense fallback={<div>Carregando dias...</div>}>
        <Await resolve={data.days}>
          {(days) => (
            <div>
              <Tabs value={selectedDate}>
                <TabsList className="flex justify-start space-x-2 mb-4">
                  {days.map((d: any) => {
                    const isSelected = d.localDateStr === selectedDate;
                    const isToday = d.localDateStr === data.today;
                    const isHoliday = d.isHoliday;

                    let tabClass = "px-4 py-2 rounded transition-colors flex items-center space-x-1";
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
                              <Link
                                to={`/admin/kds/atendimento/${d.localDateStr}`}
                                className={tabClass}
                              >
                                <span>
                                  {dayAbbr}: {formattedDate}
                                </span>
                                {isToday && (
                                  <span className="ml-1 text-[10px] bg-blue-200 text-blue-800 px-1 rounded">
                                    Hoje
                                  </span>
                                )}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{fullDate}</p>
                              {isHoliday && <p className="text-red-600 text-xs">Feriado</p>}
                              {isToday && <p className="text-blue-600 text-xs">Hoje</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
              <Outlet key={pathname} />
            </div>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
