import { Form, Link } from "@remix-run/react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import {
  compatibleUnits,
  convertQuantity,
  type ProductionPlanLine,
} from "../production-order-calc";
import { Quantity, STEP_COLORS } from "./production-ui";

type Line = { key: string; ingredientId: string; quantity: string; unit: string };
type Prep = { key: string; name: string; lines: Line[] };
export type PreparationSuggestion = {
  name: string;
  notes: string;
  ingredients: { recipeIngredientId: string; quantity: number; unit: string }[];
};

const PRESETS = ["Tangzhong", "Biga", "Poolish", "Levain", "Autólise", "Pré-massa"];
let counter = 0;
const key = () => `p${++counter}`;

/** 0,5 KG → 500 g para facilitar a digitação. */
function toInput(quantity: number, unit: string) {
  const u = unit.toUpperCase();
  if (u === "KG" && quantity < 1) return { quantity: quantity * 1000, unit: "G" };
  if (u === "L" && quantity < 1) return { quantity: quantity * 1000, unit: "ML" };
  return { quantity, unit: u };
}
const asText = (n: number) => String(Number(n.toFixed(4))).replace(".", ",");

/** Fase 2: pergunta se há preparações intermediárias e monta cada uma. */
export function PreparationsEditor({
  totals,
  suggestions,
  busy,
  canSaveToRecipe,
  cancelHref,
}: {
  totals: ProductionPlanLine[];
  suggestions: PreparationSuggestion[];
  busy: boolean;
  canSaveToRecipe: boolean;
  cancelHref?: string;
}) {
  const [has, setHas] = useState<boolean | null>(suggestions.length ? true : null);
  const [saveToRecipe, setSaveToRecipe] = useState(false);
  const [preps, setPreps] = useState<Prep[]>(() =>
    suggestions.map((p) => ({
      key: key(),
      name: p.name,
      lines: p.ingredients.map((l) => {
        const v = toInput(l.quantity, l.unit);
        return { key: key(), ingredientId: l.recipeIngredientId, quantity: asText(v.quantity), unit: v.unit };
      }),
    }))
  );
  const total = (id: string) => totals.find((t) => t.id === id);

  const used = new Map<string, number>();
  for (const p of preps)
    for (const l of p.lines) {
      const t = total(l.ingredientId);
      const q = Number(l.quantity.replace(",", ".")) || 0;
      const c = t ? convertQuantity(q, l.unit, t.unit) : null;
      if (t && c != null) used.set(t.id, (used.get(t.id) ?? 0) + c);
    }
  const over = totals.filter((t) => (used.get(t.id) ?? 0) > t.quantity + 1e-6);
  const incomplete = preps.some(
    (p) => !p.name.trim() || !p.lines.some((l) => Number(l.quantity.replace(",", ".")) > 0)
  );

  const update = (k: string, patch: Partial<Prep>) =>
    setPreps((cur) => cur.map((p) => (p.key === k ? { ...p, ...patch } : p)));
  const updateLine = (pk: string, lk: string, patch: Partial<Line>) =>
    setPreps((cur) =>
      cur.map((p) =>
        p.key === pk ? { ...p, lines: p.lines.map((l) => (l.key === lk ? { ...l, ...patch } : l)) } : p
      )
    );

  const payload = JSON.stringify({
    saveToRecipe,
    preparations: has
      ? preps.map((p) => ({
          name: p.name,
          lines: p.lines.map((l) => ({
            recipeIngredientId: l.ingredientId,
            quantity: Number(l.quantity.replace(",", ".")) || 0,
            unit: l.unit,
          })),
        }))
      : [],
  });

  if (has === null)
    return (
      <Card className="space-y-6 p-8">
        <h2 className="text-3xl font-bold">Esta produção tem preparações intermediárias?</h2>
        <p className="text-xl text-muted-foreground">
          Biga, poolish, tangzhong, autólise, levain… Se não houver, vá direto para a mistura final.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Button className="h-28 text-2xl" onClick={() => { setHas(true); setPreps([{ key: key(), name: "", lines: [] }]); }}>
            Sim, montar preparações
          </Button>
          <Form method="post">
            <input type="hidden" name="intent" value="define-preparations" />
            <input type="hidden" name="payload" value={JSON.stringify({ saveToRecipe: false, preparations: [] })} />
            <Button variant="outline" disabled={busy} className="h-28 w-full text-2xl">
              Não, só mistura final
            </Button>
          </Form>
        </div>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold">Preparações intermediárias</h2>
        <Button variant="outline" className="h-14 px-6 text-lg" onClick={() => { setHas(null); setPreps([]); }}>
          Não há preparações
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {preps.map((prep, index) => {
            const color = STEP_COLORS[index % STEP_COLORS.length];
            const free = totals.filter((t) => !prep.lines.some((l) => l.ingredientId === t.id));
            return (
              <Card key={prep.key} className={cn("overflow-hidden border-2", color.soft)}>
                <div className={cn("h-2", color.bar)} />
                <div className="space-y-4 p-5">
                  <div className="flex gap-3">
                    <Input
                      value={prep.name}
                      onChange={(e) => update(prep.key, { name: e.target.value })}
                      placeholder="Nome da preparação"
                      className="h-16 bg-background text-2xl font-bold"
                    />
                    <Button variant="outline" className="h-16 w-16 shrink-0" aria-label="Remover preparação"
                      onClick={() => setPreps((c) => c.filter((p) => p.key !== prep.key))}>
                      <Trash2 className="h-6 w-6" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((name) => (
                      <Button key={name} type="button" variant="outline" className="h-12 bg-background px-4 text-lg"
                        onClick={() => update(prep.key, { name })}>
                        {name}
                      </Button>
                    ))}
                  </div>
                  {prep.lines.map((line) => {
                    const t = total(line.ingredientId);
                    return (
                      <div key={line.key} className="flex flex-wrap items-center gap-3">
                        <span className="min-w-40 flex-1 text-xl font-medium">{t?.name}</span>
                        <Input
                          value={line.quantity}
                          inputMode="decimal"
                          onChange={(e) => updateLine(prep.key, line.key, { quantity: e.target.value })}
                          className="h-14 w-36 bg-background text-2xl font-bold tabular-nums"
                        />
                        <Select value={line.unit} onValueChange={(unit) => updateLine(prep.key, line.key, { unit })}>
                          <SelectTrigger className="h-14 w-28 bg-background text-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {compatibleUnits(t?.unit || line.unit).map((u) => (
                              <SelectItem key={u} value={u} className="py-3 text-lg">{u.toLowerCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" className="h-14 w-14" aria-label="Remover ingrediente"
                          onClick={() => update(prep.key, { lines: prep.lines.filter((l) => l.key !== line.key) })}>
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    );
                  })}
                  {free.length > 0 && (
                    <Select value="" onValueChange={(id) =>
                      update(prep.key, { lines: [...prep.lines, { key: key(), ingredientId: id, quantity: "", unit: toInput(0, total(id)!.unit).unit }] })}>
                      <SelectTrigger className="h-14 bg-background text-lg"><SelectValue placeholder="+ Adicionar ingrediente" /></SelectTrigger>
                      <SelectContent>
                        {free.map((t) => (<SelectItem key={t.id} value={t.id} className="py-3 text-lg">{t.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </Card>
            );
          })}
          <Button variant="outline" className="h-16 w-full text-xl"
            onClick={() => setPreps((c) => [...c, { key: key(), name: "", lines: [] }])}>
            <Plus className="mr-2 h-6 w-6" /> Adicionar preparação
          </Button>
        </div>

        <Card className="h-fit space-y-3 p-6">
          <h3 className="text-xl font-bold">Sobra para a mistura final</h3>
          <ul className="space-y-1 text-lg">
            {totals.map((t) => {
              const rest = t.quantity - (used.get(t.id) ?? 0);
              return (
                <li key={t.id} className={cn("flex justify-between gap-3", rest < -1e-6 && "font-bold text-destructive")}>
                  <span>{t.name}</span>
                  <Quantity quantity={Math.max(rest, 0)} unit={t.unit} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {over.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="text-lg">
            As preparações usam mais que o total de {over.map((t) => t.name).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      <Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="define-preparations" />
        <input type="hidden" name="payload" value={payload} />
        {canSaveToRecipe && (
          <label className="flex items-center gap-3 text-lg">
            <Checkbox checked={saveToRecipe} onCheckedChange={(v) => setSaveToRecipe(v === true)} className="h-6 w-6" />
            Salvar como padrão desta receita
          </label>
        )}
        <Button disabled={busy || over.length > 0 || incomplete || preps.length === 0} className="h-24 w-full text-2xl">
          Confirmar preparações
        </Button>
        {cancelHref && (
          <Button asChild variant="outline" className="h-16 w-full text-xl">
            <Link to={cancelHref}>Cancelar</Link>
          </Button>
        )}
      </Form>
    </div>
  );
}
