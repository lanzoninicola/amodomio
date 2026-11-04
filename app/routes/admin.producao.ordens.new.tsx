import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { AlertTriangle, ArrowLeft, Settings2 } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import {
  FINAL_COLOR,
  IngredientList,
  Quantity,
  STEP_COLORS,
} from "~/domain/production/components/production-ui";
import {
  compatibleUnits,
  convertQuantity,
  type ProductionPlan,
} from "~/domain/production/production-order-calc";
import {
  createProductionOrder,
  getRecipeProduction,
  listProductionRecipes,
  planForRecipe,
  type FormLike,
} from "~/domain/production/production-order.server";
import { cn } from "~/lib/utils";

function parseNumber(value: string | null) {
  const n = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const url = new URL(request.url);
  const recipeId = url.searchParams.get("recipeId") || "";
  const qty = url.searchParams.get("qty") || "";
  const date = url.searchParams.get("date") || today();
  const recipes = await listProductionRecipes();

  let recipe: Awaited<ReturnType<typeof getRecipeProduction>> | null = null;
  let plan: ProductionPlan | null = null;
  let baseQuantity = 0;
  let error = "";
  let unit = "";
  if (recipeId) {
    recipe = await getRecipeProduction(recipeId);
    const base = recipe.ingredients.find((i: any) => i.id === recipe!.baseIngredientId);
    unit = url.searchParams.get("unit") || base?.unit || "";
    if (!base) error = "Esta receita ainda não tem ingrediente-base definido.";
    else {
      const converted = convertQuantity(parseNumber(qty), unit, base.unit);
      baseQuantity = converted ?? 0;
      if (baseQuantity > 0) {
        try {
          plan = planForRecipe(recipe, baseQuantity);
        } catch (e) {
          error = (e as Error).message;
        }
      }
    }
  }
  return json({ recipes, recipe, plan, qty, unit, date, baseQuantity, error });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const form = (await request.formData()) as unknown as FormLike;
  try {
    const order = await createProductionOrder({
      recipeId: String(form.get("recipeId") || ""),
      baseQuantity: parseNumber(String(form.get("baseQuantity"))),
      productionDate: new Date(`${form.get("date") || today()}T12:00:00`),
      notes: String(form.get("notes") || ""),
    });
    return redirect(`/admin/producao/ordens/${order.id}`);
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 400 });
  }
}

export default function NewProductionOrder() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [recipeId, setRecipeId] = useState(data.recipe?.id || "");
  const [unit, setUnit] = useState(data.unit);

  const base = data.recipe?.ingredients.find((i: any) => i.id === data.recipe?.baseIngredientId);
  const units = base ? compatibleUnits(base.unit) : [];

  function refresh(delay = 0) {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => formRef.current && submit(formRef.current, { replace: true }),
      delay
    );
  }
  const plan = data.plan as ProductionPlan | null;
  const blocked = !plan || plan.inconsistencies.length > 0;
  const error = actionData?.error || data.error;

  return (
    <div className="w-full space-y-6 p-4 md:p-6 2xl:p-10">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" className="h-14 w-14">
          <Link to="/admin/producao/ordens" aria-label="Voltar">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold 2xl:text-4xl">Nova Ordem de Produção</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(22rem,1fr)_2fr]">
        <Card className="h-fit space-y-6 p-6">
          <Form method="get" ref={formRef} className="space-y-6">
            <input type="hidden" name="recipeId" value={recipeId} />
            <input type="hidden" name="unit" value={unit} />
            <div className="space-y-2">
              <Label className="text-lg">1. Receita</Label>
              <Select
                value={recipeId}
                onValueChange={(v) => {
                  setRecipeId(v);
                  setUnit("");
                  setTimeout(() => refresh(), 0);
                }}
              >
                <SelectTrigger className="h-16 text-xl">
                  <SelectValue placeholder="Selecione a receita" />
                </SelectTrigger>
                <SelectContent>
                  {data.recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="py-3 text-lg">
                      {r.name}
                      {r.status === "draft" ? " (rascunho)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.recipe && (
                <Button asChild variant="link" className="h-auto p-0 text-base">
                  <Link to={`/admin/producao/receitas/${data.recipe.id}`}>
                    <Settings2 className="mr-1 h-4 w-4" /> Configurar base e preparações
                  </Link>
                </Button>
              )}
            </div>

            {base && (
              <div className="space-y-2">
                <Label className="text-lg">2. Quantidade de {base.name}</Label>
                <div className="flex gap-3">
                  <Input
                    name="qty"
                    inputMode="decimal"
                    defaultValue={data.qty}
                    placeholder="0"
                    className="h-20 text-4xl font-bold tabular-nums"
                    onChange={() => refresh(400)}
                  />
                  <Select
                    value={unit || base.unit}
                    onValueChange={(v) => {
                      setUnit(v);
                      setTimeout(() => refresh(), 0);
                    }}
                  >
                    <SelectTrigger className="h-20 w-32 text-2xl font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u} value={u} className="py-3 text-lg">
                          {u.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-lg">3. Data de produção</Label>
              <Input
                type="date"
                name="date"
                defaultValue={data.date}
                className="h-16 text-xl"
                onChange={() => refresh(200)}
              />
            </div>
          </Form>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription className="text-base">{error}</AlertDescription>
            </Alert>
          )}

          <Form method="post" className="space-y-4">
            <input type="hidden" name="recipeId" value={recipeId} />
            <input type="hidden" name="baseQuantity" value={data.baseQuantity} />
            <input type="hidden" name="date" value={data.date} />
            <Input name="notes" placeholder="Observações (opcional)" className="h-14 text-lg" />
            <Button
              type="submit"
              size="lg"
              disabled={blocked || navigation.state !== "idle"}
              className="h-20 w-full text-2xl"
            >
              Criar OP
            </Button>
          </Form>
        </Card>

        <div className="space-y-4">
          {!plan && (
            <Card className="p-10 text-center text-xl text-muted-foreground">
              Selecione a receita e informe a quantidade-base para ver a prévia.
            </Card>
          )}
          {plan && data.recipe && (
            <>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <div className="text-lg text-muted-foreground">Produzir</div>
                  <div className="text-3xl font-bold">{data.recipe.name}</div>
                </div>
                {base && (
                  <div className="text-right">
                    <div className="text-lg text-muted-foreground">Base · {base.name}</div>
                    <Quantity quantity={data.baseQuantity} unit={base.unit} className="text-5xl" />
                  </div>
                )}
              </Card>

              {plan.inconsistencies.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle>Inconsistência na receita</AlertTitle>
                  <AlertDescription className="text-base">
                    {plan.inconsistencies.join(" ")}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 2xl:grid-cols-2">
                {plan.preparations.map((p, i) => {
                  const color = STEP_COLORS[i % STEP_COLORS.length];
                  return (
                    <Card key={p.id} className={cn("overflow-hidden border-2", color.soft)}>
                      <div className={cn("h-2", color.bar)} />
                      <div className="space-y-3 p-5">
                        <h3 className={cn("text-2xl font-bold", color.text)}>
                          Preparação {i + 1} — {p.name}
                        </h3>
                        <IngredientList lines={p.ingredients} />
                      </div>
                    </Card>
                  );
                })}
                <Card className={cn("overflow-hidden border-2", FINAL_COLOR.soft)}>
                  <div className={cn("h-2", FINAL_COLOR.bar)} />
                  <div className="space-y-3 p-5">
                    <h3 className="text-2xl font-bold">Mistura final</h3>
                    {plan.final.preparedItems.length > 0 && (
                      <p className="text-lg">
                        Utilizar: {plan.final.preparedItems.map((n) => `${n} preparado`).join(", ")}
                      </p>
                    )}
                    <IngredientList lines={plan.final.ingredients} />
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
