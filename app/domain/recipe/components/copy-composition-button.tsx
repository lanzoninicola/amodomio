import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import { Copy } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

type Candidate = { id: string; name: string; version: number; status: string; Item: { name: string } | null; _count: { RecipeIngredient: number } };
export function CopyCompositionButton({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [includeVariations, setIncludeVariations] = useState(false);
  const sources = useFetcher<{ status: number; message?: string; payload?: { candidates: Candidate[] } }>();
  const copy = useFetcher<{ status: number; message?: string }>();
  const endpoint = `/admin/recipes/${recipeId}/copy-composition`;
  const busy = copy.state !== "idle";
  const candidates = sources.data?.payload?.candidates || [];
  const selected = candidates.find(c => c.id === source);
  useEffect(() => {
    if (copy.state === "idle" && copy.data?.status === 200) setOpen(false);
  }, [copy.state, copy.data]);
  return <>
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => {
      setSource(""); setSearch(""); setIncludeVariations(false); setOpen(true); sources.load(endpoint);
    }}><Copy size={14} />Copiar composição</Button>
    {!open && copy.data?.status === 200 && <p role="status" className="text-xs text-emerald-700">Composição copiada com sucesso.</p>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Copiar composição de outra receita</DialogTitle><DialogDescription>Adiciona os ingredientes que faltam e mantém os ingredientes atuais.</DialogDescription></DialogHeader>
        <label className="grid gap-1 text-sm">Buscar receita ou item
          <input className="rounded-md border px-3 py-2" value={search} onChange={e => setSearch(e.target.value)} disabled={busy} placeholder="Digite um nome" />
        </label>
        <Select value={source} onValueChange={setSource} disabled={busy || sources.state !== "idle"}>
          <SelectTrigger aria-label="Receita de origem"><SelectValue placeholder={sources.state !== "idle" ? "Carregando receitas..." : "Selecione a receita de origem"} /></SelectTrigger>
          <SelectContent>{candidates.filter(c => `${c.name} ${c.Item?.name || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(c =>
            <SelectItem key={c.id} value={c.id}>{c.name} — {c.Item?.name || "Sem item"} · v{c.version} · {c.status === "active" ? "Ativa" : c.status === "draft" ? "Rascunho" : "Arquivada"}</SelectItem>
          )}</SelectContent>
        </Select>
        {sources.state === "idle" && !candidates.length && <p className="text-sm text-slate-500">Nenhuma receita disponível para copiar.</p>}
        {selected && <p className="text-sm text-slate-600">Origem: {selected.name}. {selected._count.RecipeIngredient} ingrediente(s).</p>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={includeVariations} onChange={e => setIncludeVariations(e.target.checked)} disabled={busy} />Copiar também as variações com as quantidades por variação</label>
        <p className="text-sm text-slate-500">{includeVariations ? "Cria as variações que faltam no item de destino e copia quantidades, unidades e perdas. As quantidades dos ingredientes em comum serão substituídas nas variações copiadas." : "Os novos ingredientes ficam com quantidade zero. As quantidades já cadastradas são mantidas."}</p>
        {(copy.data?.status || 0) >= 400 && <p role="alert" className="text-sm text-red-600">{copy.data?.message}</p>}
        {(sources.data?.status || 0) >= 400 && <p role="alert" className="text-sm text-red-600">{sources.data?.message}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!selected || busy || sources.state !== "idle"} onClick={() => copy.submit({ sourceRecipeId: source, includeVariations: includeVariations ? "yes" : "no" }, { method: "post", action: endpoint, preventScrollReset: true })}>{busy ? "Copiando..." : "Confirmar cópia"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
