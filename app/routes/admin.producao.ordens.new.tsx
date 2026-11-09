import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { AlertTriangle, ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
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
  IngredientList,
  Quantity,
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const url = new URL(request.url);
  const recipeId = url.searchParams.get("recipeId") || "";
  const qty = url.searchParams.get("qty") || "";
  const requestedBaseId = url.searchParams.get("baseId") || "";
  const date = url.searchParams.get("date") || today();
  const usage = url.searchParams.get("usage") || "";
  const recipes = await listProductionRecipes();

  let recipe: Awaited<ReturnType<typeof getRecipeProduction>> | null = null;
  let plan: ProductionPlan | null = null;
  let baseQuantity = 0;
  let error = "";
  let unit = "";
  let baseId = "";
  if (recipeId) {
    recipe = await getRecipeProduction(recipeId);
    baseId =
      recipe.ingredients.find((i: any) => i.id === requestedBaseId)?.id ||
      recipe.baseIngredientId ||
      "";
    const base = recipe.ingredients.find((i: any) => i.id === baseId);
    unit = url.searchParams.get("unit") || base?.unit || "";
    if (base) {
      const converted = convertQuantity(parseNumber(qty), unit, base.unit);
      baseQuantity = converted ?? 0;
      if (baseQuantity > 0) {
        try {
          plan = planForRecipe(recipe, baseQuantity, base.id);
        } catch (e) {
          error = (e as Error).message;
        }
      }
    }
  }
  return json({ recipes, recipe, plan, qty, unit, date, usage, baseQuantity, baseId, error });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const form = (await request.formData()) as unknown as FormLike;
  try {
    const order = await createProductionOrder({
      recipeId: String(form.get("recipeId") || ""),
      baseIngredientId: String(form.get("baseIngredientId") || ""),
      baseQuantity: parseNumber(String(form.get("baseQuantity"))),
      productionDate: new Date(`${form.get("date") || today()}T12:00:00`),
      usageDate: form.get("usageDate") ? new Date(`${form.get("usageDate")}T12:00:00`) : null,
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
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const selectedRecipe = data.recipes.find((r) => r.id === recipeId);

  const [previewPending, setPreviewPending] = useState(false);
  useEffect(() => { setPreviewPending(false); }, [data]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const [baseId, setBaseId] = useState(data.baseId);
  const base = data.recipe?.ingredients.find((i: any) => i.id === data.baseId);
  const units = base ? compatibleUnits(base.unit) : [];

  function refresh(delay = 0) {
    setPreviewPending(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => formRef.current && submit(formRef.current, { replace: true }),
      delay
    );
  }
  const plan = data.plan as ProductionPlan | null;
  const blocked = previewPending || recipeId !== data.recipe?.id || !plan || plan.inconsistencies.length > 0 || baseId !== data.baseId;
  const error = actionData?.error || data.error;

  return (
    <div className="w-full space-y-6 p-4 md:p-6 2xl:p-10">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" className="h-14 w-14">
          <Link to="/admin/producao/ordens" aria-label="Voltar">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold 2xl:text-4xl">Nova produção</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(22rem,1fr)_2fr]">
        <Card className="h-fit space-y-6 p-6">
          <Form method="get" ref={formRef} className="space-y-6">
            <input type="hidden" name="recipeId" value={recipeId} />
            <input type="hidden" name="baseId" value={recipeId === data.recipe?.id ? baseId : ""} />
            <input type="hidden" name="unit" value={unit || (recipeId === data.recipe?.id ? data.unit : "")} />
            <div className="space-y-2">
              <Label id="production-recipe-label" className="text-lg">1. Receita</Label>
              <Dialog open={recipePickerOpen} onOpenChange={setRecipePickerOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-labelledby="production-recipe-label production-recipe-value"
                    className="h-auto min-h-16 w-full justify-between gap-3 px-4 py-3 text-left text-xl font-medium"
                  >
                    <span id="production-recipe-value" className={cn("min-w-0 whitespace-normal break-words", !selectedRecipe && "text-muted-foreground")}>
                      {selectedRecipe?.name || "Buscar e escolher receita"}
                    </span>
                    <ChevronsUpDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:flex [&>button:last-child]:h-10 [&>button:last-child]:w-10 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
                  <DialogHeader className="shrink-0 px-6 pb-4 pt-6 pr-16 text-left">
                    <DialogTitle className="text-2xl">Escolher receita</DialogTitle>
                    <DialogDescription className="text-base">
                      Busque pelo nome e toque na receita para selecionar.
                    </DialogDescription>
                  </DialogHeader>
                  <Command className="min-h-0 rounded-none [&_[data-slot=command-input-wrapper]]:h-16 [&_[data-slot=command-input-wrapper]]:shrink-0 [&_[data-slot=command-input-wrapper]]:px-5">
                    <CommandInput
                      placeholder="Digite o nome da receita…"
                      aria-label="Buscar receita pelo nome"
                      className="h-16 text-lg"
                    />
                    <CommandList className="max-h-[min(28rem,calc(100dvh-16rem))] min-h-0 overflow-y-auto overscroll-contain p-2">
                      <CommandEmpty>Nenhuma receita encontrada. Tente outro nome.</CommandEmpty>
                      {data.recipes.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={r.id}
                          keywords={[r.name]}
                          onSelect={() => {
                            setPreviewPending(true);
                            setRecipeId(r.id);
                            setUnit("");
                            setBaseId("");
                            setRecipePickerOpen(false);
                            setTimeout(() => refresh(), 0);
                          }}
                          className="min-h-16 cursor-pointer gap-4 rounded-lg px-4 py-3 text-lg data-[selected=true]:bg-slate-100"
                        >
                          <span className="min-w-0 flex-1 whitespace-normal break-words">
                            <span className="block font-medium">{r.name}</span>
                            {r.status === "draft" && <span className="text-sm text-muted-foreground">Rascunho</span>}
                          </span>
                          {r.id === recipeId && <Check className="h-6 w-6 shrink-0 text-emerald-600" aria-label="Receita selecionada" />}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                  <div className="shrink-0 border-t bg-muted/30 px-6 py-3 text-sm text-muted-foreground">
                    {data.recipes.length} receitas disponíveis
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {data.recipe && recipeId === data.recipe.id && (
              <div className="space-y-2">
                <Label className="text-lg">2. Ingrediente-base</Label>
                <Select
                  value={baseId}
                  onValueChange={(v) => {
                    setPreviewPending(true);
                    setBaseId(v);
                    setUnit("");
                    setTimeout(() => refresh(), 0);
                  }}
                >
                  <SelectTrigger className="h-16 text-xl">
                    <SelectValue placeholder="Qual ingrediente define a quantidade?" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.recipe.ingredients.map((i: any) => (
                      <SelectItem key={i.id} value={i.id} className="py-3 text-lg">
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {base && (
              <div className="space-y-2">
                <Label className="text-lg">3. Quantidade de {base.name}</Label>
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
                      setPreviewPending(true);
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
              <Label className="text-lg">4. Produzir em</Label>
              <Input
                type="date"
                name="date"
                defaultValue={data.date}
                className="h-16 text-xl"
                onChange={() => refresh(200)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-lg">5. Usar em (opcional)</Label>
              <p className="text-sm text-muted-foreground">
                Dia em que o resultado será usado. Ex.: biga feita hoje para a massa de amanhã.
              </p>
              <Input
                type="date"
                name="usage"
                min={data.date}
                defaultValue={data.usage}
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
            <input type="hidden" name="baseIngredientId" value={data.baseId} />
            <input type="hidden" name="baseQuantity" value={data.baseQuantity} />
            <input type="hidden" name="date" value={data.date} />
            <input type="hidden" name="usageDate" value={data.usage} />
            <Input name="notes" placeholder="Observações (opcional)" className="h-14 text-lg" />
            <Button
              type="submit"
              size="lg"
              disabled={blocked || navigation.state !== "idle"}
              className="h-20 w-full text-2xl"
            >
              Criar OP e continuar
            </Button>
          </Form>
        </Card>

        <div className="space-y-4">
          {!plan && (
            <Card className="p-10 text-center text-xl text-muted-foreground">
              Escolha a receita, o ingrediente-base e a quantidade para ver o que será necessário.
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
                    <div className="text-lg text-muted-foreground">Ingrediente principal · {base.name}</div>
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

              <Card className="space-y-4 p-6">
                <h3 className="text-2xl font-bold">Ingredientes desta produção</h3>
                <IngredientList lines={plan.totals} />
                <p className="text-lg text-muted-foreground">
                  Na próxima etapa você informa se há preparações intermediárias (biga, poolish, autólise…).
                </p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
