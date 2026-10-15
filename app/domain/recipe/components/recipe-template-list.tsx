import { Search, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string | Date;
};

const pageSize = 10;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function RecipeTemplateList({
  templates,
  query,
  page,
  onQueryChange,
  onPageChange,
  onSelect,
  onDelete,
  presentation = "mobile",
}: {
  presentation?: "mobile" | "tv";
  templates: TemplateListItem[];
  query: string;
  page: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (template: TemplateListItem) => void;
  onDelete: (template: TemplateListItem) => void;
}) {
  const tv = presentation === "tv";
  const term = normalize(query.trim());
  const filtered = templates.filter((template) =>
    normalize(`${template.name} ${template.description || ""}`).includes(term)
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  return (
    <div className={tv ? "space-y-6" : "space-y-4"}>
      <div className={tv ? "max-w-3xl space-y-3" : "space-y-2"}>
        <label
          htmlFor="template-search"
          className={
            tv
              ? "text-xl font-semibold text-slate-200"
              : "text-sm font-medium text-slate-700"
          }
        >
          Pesquisar templates
        </label>
        <div className="relative">
          <Search
            className={
              tv
                ? "pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400"
                : "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            }
            aria-hidden="true"
          />
          <Input
            id="template-search"
            type="search"
            value={query}
            placeholder="Nome ou descrição"
            className={
              tv
                ? "h-16 rounded-xl border-slate-500 bg-slate-900 pl-14 pr-5 text-2xl text-white placeholder:text-slate-400 focus-visible:ring-violet-400"
                : "h-11 pl-9"
            }
            onChange={(event) => {
              onQueryChange(event.target.value);
            }}
          />
        </div>
      </div>
      <p
        className={tv ? "text-lg text-slate-400" : "text-xs text-slate-500"}
        aria-live="polite"
      >
        {filtered.length
          ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} de ${
              filtered.length
            } templates`
          : "0 templates"}
        {term && filtered.length !== templates.length
          ? ` (${templates.length} no total)`
          : ""}
      </p>
      <div
        className={tv ? "grid auto-rows-fr gap-5 xl:grid-cols-2" : "space-y-2"}
      >
        {visible.map((template) => (
          <div
            key={template.id}
            className={
              tv
                ? "flex h-full items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 transition-colors hover:border-violet-400"
                : "flex items-center gap-1 rounded-xl border border-slate-200 bg-white"
            }
          >
            <button
              type="button"
              className={
                tv
                  ? "flex min-h-44 min-w-0 flex-1 flex-col items-start self-stretch rounded-l-2xl px-7 py-6 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                  : "min-w-0 flex-1 rounded-l-xl px-4 py-3 text-left hover:bg-slate-50"
              }
              onClick={() => onSelect(template)}
            >
              <span
                className={
                  tv
                    ? "block break-words text-3xl font-bold leading-snug text-white"
                    : "block break-words text-sm font-semibold text-slate-900"
                }
              >
                {template.name}
              </span>
              {template.description ? (
                <span
                  className={
                    tv
                      ? "mt-3 block line-clamp-2 text-xl leading-relaxed text-slate-300"
                      : "mt-1 block line-clamp-2 text-xs leading-5 text-slate-500"
                  }
                >
                  {template.description}
                </span>
              ) : null}
              <span
                className={
                  tv
                    ? "mt-auto block pt-5 font-mono text-lg tabular-nums text-slate-400"
                    : "mt-1 block text-xs text-slate-400"
                }
              >
                {new Date(template.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              className={
                tv
                  ? "mr-5 h-14 w-14 shrink-0 rounded-xl border border-slate-600 p-0 text-slate-300 hover:border-red-500 hover:bg-red-950 hover:text-red-200"
                  : "mr-2 h-11 w-11 shrink-0 p-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
              }
              aria-label={`Excluir template ${template.name}`}
              title="Excluir template"
              onClick={() => onDelete(template)}
            >
              <Trash2
                className={tv ? "h-6 w-6" : "h-4 w-4"}
                aria-hidden="true"
              />
            </Button>
          </div>
        ))}
        {!visible.length ? (
          <p
            className={
              tv
                ? "col-span-full rounded-2xl border border-dashed border-slate-600 p-10 text-center text-2xl text-slate-300"
                : "rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
            }
          >
            {term
              ? "Nenhum template encontrado para esta busca."
              : "Nenhum template salvo para esta receita."}
          </p>
        ) : null}
      </div>
      {pages > 1 ? (
        <div
          className={
            tv
              ? "flex items-center justify-between gap-4 border-t border-slate-700 pt-6"
              : "flex items-center justify-between gap-2 border-t border-slate-200 pt-3"
          }
        >
          <Button
            type="button"
            variant="outline"
            className={
              tv
                ? "h-14 border-slate-600 bg-slate-900 px-6 text-xl text-white hover:bg-slate-800 hover:text-white"
                : "h-11"
            }
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Anterior
          </Button>
          <span
            className={tv ? "text-lg text-slate-400" : "text-xs text-slate-500"}
          >
            {currentPage + 1} / {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            className={
              tv
                ? "h-14 border-slate-600 bg-slate-900 px-6 text-xl text-white hover:bg-slate-800 hover:text-white"
                : "h-11"
            }
            disabled={currentPage >= pages - 1}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
