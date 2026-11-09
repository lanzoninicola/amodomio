import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { authenticator } from "~/domain/auth/google.server";
import { Quantity, STEP_COLORS } from "~/domain/production/components/production-ui";
import { compatibleUnits, convertQuantity } from "~/domain/production/production-order-calc";
import {
  getRecipeProduction,
  saveRecipeProduction,
  type FormLike,
} from "~/domain/production/production-order.server";
import { cn } from "~/lib/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  return json({ recipe: await getRecipeProduction(String(params.recipeId)) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const form = (await request.formData()) as unknown as FormLike;
  try {
    const payload = JSON.parse(String(form.get("payload") || "{}"));
    await saveRecipeProduction(String(params.recipeId), {
      baseIngredientId: String(payload.baseIngredientId || ""),
      preparations: (payload.preparations || []).map((p: any) => ({
        name: String(p.name || ""),
        notes: String(p.notes || ""),
        ingredients: (p.lines || []).map((l: any) => ({
          recipeIngredientId: String(l.ingredientId),
          quantity: Number(String(l.quantity || "0").replace(",", ".")),
          unit: String(l.unit),
        })),
      })),
    });
    return json({ ok: true as const });
  } catch (e) {
    return json({ ok: false as const, error: (e as Error).message }, { status: 400 });
  }
}

type Line = { key: string; ingredientId: string; quantity: string; unit: string };
type Prep = { key: string; name: string; notes: string; lines: Line[] };

let counter = 0;
const key = () => `k${++counter}`;

/** Mostra 0,5 KG como 500 g para facilitar a edição. */
function toInput(quantity: number, unit: string) {
  const u = unit.toUpperCase();
  if (u === "KG" && quantity < 1) return { quantity: quantity * 1000, unit: "G" };
  if (u === "L" && quantity < 1) return { quantity: quantity * 1000, unit: "ML" };
  return { quantity, unit: u };
}

export default function RecipeProductionConfig() {
  const { recipe } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [baseId, setBaseId] = useState(recipe.baseIngredientId || "");
  const [preps, setPreps] = useState<Prep[]>(() =>
    recipe.preparations.map((p) => ({
      key: key(),
      name: p.name,
      notes: p.notes || "",
      lines: p.ingredients.map((l: { recipeIngredientId: string; quantity: number }) => {
        const ing = recipe.ingredients.find((i) => i.id === l.recipeIngredientId);
        const v = toInput(l.quantity, ing?.unit || "UN");
        return {
          key: key(),
          ingredientId: l.recipeIngredientId,
          quantity: String(Number(v.quantity.toFixed(4))).replace(".", ","),
          unit: v.unit,
        };
      }),
    }))
  );

  const ingredient = (id: string) => recipe.ingredients.find((i) => i.id === id);
  const used = new Map<string, number>();
  for (const p of preps)
    for (const l of p.lines) {
      const ing = ingredient(l.ingredientId);
      const q = Number(l.quantity.replace(",", ".")) || 0;
      const c = ing ? convertQuantity(q, l.unit, ing.unit) : null;
      if (ing && c != null) used.set(ing.id, (used.get(ing.id) ?? 0) + c);
    }
  const over = recipe.ingredients.filter((i) => (used.get(i.id) ?? 0) > i.quantity + 1e-6);

  const updatePrep = (k: string, patch: Partial<Prep>) =>
    setPreps((cur) => cur.map((p) => (p.key === k ? { ...p, ...patch } : p)));
  const updateLine = (pk: string, lk: string, patch: Partial<Line>) =>
    setPreps((cur) =>
      cur.map((p) =>
        p.key === pk ? { ...p, lines: p.lines.map((l) => (l.key === lk ? { ...l, ...patch } : l)) } : p
      )
    );

  const payload = JSON.stringify({ baseIngredientId: baseId, preparations: preps });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6 2xl:p-10">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" className="h-14 w-14">
          <Link to={`/admin/producao/ordens/new?recipeId=${recipe.id}`} aria-label="Voltar">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <div>
          <div className="text-lg text-muted-foreground">Produção · Receita</div>
          <h1 className="text-3xl font-bold 2xl:text-4xl">{recipe.name}</h1>
        </div>
      </div>

      <Card className="space-y-3 p-6">
        <Label className="text-xl">Ingrediente-base (dimensiona a OP)</Label>
        <Select value={baseId} onValueChange={setBaseId}>
          <SelectTrigger className="h-16 text-xl">
            <SelectValue placeholder="Selecione o ingrediente" />
          </SelectTrigger>
          <SelectContent>
            {recipe.ingredients.map((i) => (
              <SelectItem key={i.id} value={i.id} className="py-3 text-lg">
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Preparações intermediárias</h2>
        <Button
          variant="outline"
          className="h-14 px-6 text-lg"
          onClick={() => setPreps((c) => [...c, { key: key(), name: "", notes: "", lines: [] }])}
        >
          <Plus className="mr-2 h-5 w-5" /> Adicionar preparação
        </Button>
      </div>
      {preps.length === 0 && (
        <p className="text-lg text-muted-foreground">
          Sem preparações: a receita vai direto para a mistura final.
        </p>
      )}

      {preps.map((prep, index) => {
        const color = STEP_COLORS[index % STEP_COLORS.length];
        const free = recipe.ingredients.filter((i) => !prep.lines.some((l) => l.ingredientId === i.id));
        return (
          <Card key={prep.key} className={cn("overflow-hidden border-2", color.soft)}>
            <div className={cn("h-2", color.bar)} />
            <div className="space-y-4 p-5">
              <div className="flex gap-3">
                <Input
                  value={prep.name}
                  onChange={(e) => updatePrep(prep.key, { name: e.target.value })}
                  placeholder="Nome (ex.: Biga, Poolish, Autólise)"
                  className="h-16 bg-background text-2xl font-bold"
                />
                <Button
                  variant="outline"
                  className="h-16 w-16 shrink-0"
                  aria-label="Remover preparação"
                  onClick={() => setPreps((c) => c.filter((p) => p.key !== prep.key))}
                >
                  <Trash2 className="h-6 w-6" />
                </Button>
              </div>
              {prep.lines.map((line) => {
                const ing = ingredient(line.ingredientId);
                return (
                  <div key={line.key} className="flex flex-wrap items-center gap-3">
                    <span className="min-w-40 flex-1 text-xl font-medium">{ing?.name}</span>
                    <Input
                      value={line.quantity}
                      inputMode="decimal"
                      onChange={(e) => updateLine(prep.key, line.key, { quantity: e.target.value })}
                      className="h-14 w-36 bg-background text-2xl font-bold tabular-nums"
                    />
                    <Select
                      value={line.unit}
                      onValueChange={(unit) => updateLine(prep.key, line.key, { unit })}
                    >
                      <SelectTrigger className="h-14 w-28 bg-background text-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleUnits(ing?.unit || line.unit).map((u) => (
                          <SelectItem key={u} value={u} className="py-3 text-lg">
                            {u.toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      className="h-14 w-14"
                      aria-label="Remover ingrediente"
                      onClick={() =>
                        updatePrep(prep.key, { lines: prep.lines.filter((l) => l.key !== line.key) })
                      }
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                );
              })}
              {free.length > 0 && (
                <Select
                  value=""
                  onValueChange={(id) =>
                    updatePrep(prep.key, {
                      lines: [
                        ...prep.lines,
                        {
                          key: key(),
                          ingredientId: id,
                          quantity: "",
                          unit: toInput(0, ingredient(id)!.unit).unit,
                        },
                      ],
                    })
                  }
                >
                  <SelectTrigger className="h-14 bg-background text-lg">
                    <SelectValue placeholder="+ Adicionar ingrediente" />
                  </SelectTrigger>
                  <SelectContent>
                    {free.map((i) => (
                      <SelectItem key={i.id} value={i.id} className="py-3 text-lg">
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </Card>
        );
      })}

      <Card className="space-y-2 p-6">
        <h3 className="text-xl font-bold">Conferência dos ingredientes</h3>
        <ul className="space-y-1 text-lg">
          {recipe.ingredients.map((i) => {
            const u = used.get(i.id) ?? 0;
            const bad = u > i.quantity + 1e-6;
            return (
              <li key={i.id} className={cn("flex justify-between gap-3", bad && "font-bold text-destructive")}>
                <span>{i.name}</span>
                <span className="flex gap-2">
                  <Quantity quantity={u} unit={i.unit} /> / <Quantity quantity={i.quantity} unit={i.unit} />
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {over.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="text-lg">
            Inconsistência: as preparações usam mais que o total de {over.map((i) => i.name).join(", ")}.
          </AlertDescription>
        </Alert>
      )}
      {result && !result.ok && (
        <Alert variant="destructive">
          <AlertDescription className="text-lg">{result.error}</AlertDescription>
        </Alert>
      )}
      {result?.ok && (
        <Alert>
          <AlertDescription className="text-lg">Configuração salva.</AlertDescription>
        </Alert>
      )}

      <Form method="post">
        <input type="hidden" name="payload" value={payload} />
        <Button
          type="submit"
          disabled={!baseId || over.length > 0 || navigation.state !== "idle"}
          className="h-20 w-full text-2xl"
        >
          Salvar
        </Button>
      </Form>
    </div>
  );
}
