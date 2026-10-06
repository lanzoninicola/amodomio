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
}: {
  templates: TemplateListItem[];
  query: string;
  page: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (template: TemplateListItem) => void;
  onDelete: (template: TemplateListItem) => void;
}) {
  const term = normalize(query.trim());
  const filtered = templates.filter((template) =>
    normalize(`${template.name} ${template.description || ""}`).includes(term)
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="template-search"
          className="text-sm font-medium text-slate-700"
        >
          Pesquisar templates
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            id="template-search"
            type="search"
            value={query}
            placeholder="Nome ou descrição"
            className="h-11 pl-9"
            onChange={(event) => {
              onQueryChange(event.target.value);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500" aria-live="polite">
        {filtered.length
          ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} de ${
              filtered.length
            } templates`
          : "0 templates"}
        {term && filtered.length !== templates.length
          ? ` (${templates.length} no total)`
          : ""}
      </p>
      <div className="space-y-2">
        {visible.map((template) => (
          <div
            key={template.id}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white"
          >
            <button
              type="button"
              className="min-w-0 flex-1 rounded-l-xl px-4 py-3 text-left hover:bg-slate-50"
              onClick={() => onSelect(template)}
            >
              <span className="block break-words text-sm font-semibold text-slate-900">
                {template.name}
              </span>
              {template.description ? (
                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                  {template.description}
                </span>
              ) : null}
              <span className="mt-1 block text-xs text-slate-400">
                {new Date(template.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              className="mr-2 h-11 w-11 shrink-0 p-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
              aria-label={`Excluir template ${template.name}`}
              title="Excluir template"
              onClick={() => onDelete(template)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        {!visible.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            {term
              ? "Nenhum template encontrado para esta busca."
              : "Nenhum template salvo para esta receita."}
          </p>
        ) : null}
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            {currentPage + 1} / {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-11"
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
