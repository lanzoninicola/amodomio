import { defer } from "@remix-run/node";
import {
  Await,
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
  useLocation,
  useRevalidator,
} from "@remix-run/react";
import { Suspense } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/* ===== Helpers de data ===== */
function pad2(n: number) { return String(n).padStart(2, "0"); }
function formatLocalDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d: Date, days: number) { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; }
function humanDayLabel(d: Date) {
  const dd = pad2(d.getDate()), mm = pad2(d.getMonth() + 1);
  const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${dd}/${mm} (${wk})`;
}

/* ===== Loader: janela curta (-5 a +3) de dias ===== */
export async function loader() {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  const start = addDays(today, -5);
  const end = addDays(today, +3);

  const days: { dateStr: string; label: string }[] = [];
  for (let dt = new Date(start); dt <= end; dt = addDays(dt, 1)) {
    days.push({ dateStr: formatLocalDate(dt), label: humanDayLabel(dt) });
  }

  return defer({ days, today: todayStr });
}

/* ===== Página (topbar sticky: Select + Atualizar) ===== */
export default function CozinhaWrapper() {
  const data = useLoaderData<typeof loader>();
  const { date } = useParams();               // pode estar undefined
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { revalidate, state } = useRevalidator();

  // ❗Não definimos mais valor inicial: placeholder aparece até o usuário escolher
  const selectedDate = date ?? undefined;

  return (
    <div className="min-h-screen">
      {/* Topbar fixa */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-2 p-2">
          <Select
            value={selectedDate} // undefined => mostra placeholder
            onValueChange={(val) => navigate(`/admin/kds/cozinha/${val}`)}
          >
            <SelectTrigger className="w-full h-12 text-base">
              <SelectValue placeholder="Selecione a data" />
            </SelectTrigger>
            <SelectContent className="max-h-[55vh]">
              {data.days.map((d) => (
                <SelectItem
                  key={d.dateStr}
                  value={d.dateStr}
                  className="text-base py-3"
                >
                  {d.label}{d.dateStr === data.today ? " — Hoje" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            onClick={() => revalidate()}
            title="Atualizar agora"
            className="shrink-0"
            disabled={state === "loading"}
          >
            <RefreshCw className={`w-5 h-5 ${state === "loading" ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Conteúdo rolável: só renderiza algo quando houver :date */}
      <div className="max-w-md mx-auto p-3">
        <Suspense fallback={<div>Carregando…</div>}>
          <Await resolve={data.days}>
            {() => (selectedDate ? <Outlet key={pathname} /> : null)}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}
