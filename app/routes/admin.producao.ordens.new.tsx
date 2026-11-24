import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  PackageOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Container from "~/components/layout/container/container";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
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
  type ProductionOrderItemSnapshot,
} from "~/domain/production/production-order-calc";
import {
  createProductionOrderTemplate,
  getProductionOrderTemplate,
  getRecipeProduction,
  listProductionProductChoices,
  listRecipeProductionProducts,
  listProductionRecipes,
  planForRecipe,
  type FormLike,
} from "~/domain/production/production-order.server";
import { cn } from "~/lib/utils";

function parseNumber(value: string | null) {
  const n = Number(
    String(value || "")
      .trim()
      .replace(",", ".")
  );
  return Number.isFinite(n) ? n : 0;
}

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId") || "";
  const template = templateId
    ? await getProductionOrderTemplate(templateId)
    : null;
  if (template?.archivedAt) throw new Response("OP arquivada", { status: 404 });
  const recipeId = url.searchParams.get("recipeId") || "";
  const qty = url.searchParams.get("qty") || "";
  const requestedBaseId = url.searchParams.get("baseId") || "";
  const calculationMode =
    url.searchParams.get("mode") === "yield" ? "yield" : "ingredient";
  const date = url.searchParams.get("date") || today();
  const usage = url.searchParams.get("usage") || "";
  const recipes = await listProductionRecipes();
  const planningMode = url.searchParams.get("planningMode") || "semiFinished";
  const productChoices =
    planningMode === "finalProducts" && !recipeId
      ? await listProductionProductChoices()
      : [];

  let recipe: Awaited<ReturnType<typeof getRecipeProduction>> | null = null;
  let plan: ProductionPlan | null = null;
  let baseQuantity = 0;
  let error = "";
  let unit = "";
  let baseId = "";
  let products: Awaited<ReturnType<typeof listRecipeProductionProducts>> = [];
  let productMix: Array<{
    itemVariationId: string;
    itemName: string;
    variationName: string;
    quantity: number;
    recipeBatches: number;
  }> = [];
  let unallocatedRecipeBatches = 0;
  if (recipeId) {
    recipe = await getRecipeProduction(recipeId);
    products = await listRecipeProductionProducts(recipeId);
    baseId =
      recipe.ingredients.find((i: any) => i.id === requestedBaseId)?.id ||
      recipe.baseIngredientId ||
      (planningMode === "finalProducts" || calculationMode === "yield"
        ? recipe.ingredients.find((i: any) => i.quantity > 0)?.id
        : "") ||
      "";
    const base = recipe.ingredients.find((i: any) => i.id === baseId);
    unit = url.searchParams.get("unit") || base?.unit || "";
    if (base) {
      const requestedMix = products
        .map((product) => {
          const quantity = parseNumber(
            url.searchParams.get(`product_${product.itemVariationId}`)
          );
          return {
            itemVariationId: product.itemVariationId,
            itemName: product.itemName,
            variationName: product.variationName,
            quantity,
            recipeBatches: quantity * Number(product.recipeBatchesPerUnit || 0),
          };
        })
        .filter((line) => line.quantity > 0);
      const requestedBatches = requestedMix.reduce(
        (sum, line) => sum + line.recipeBatches,
        0
      );
      productMix = requestedMix;
      if (planningMode === "finalProducts" && requestedBatches > 0) {
        baseQuantity = base.quantity * requestedBatches;
      } else if (calculationMode === "yield") {
        baseQuantity = base.quantity * parseNumber(qty);
      } else {
        const converted = convertQuantity(parseNumber(qty), unit, base.unit);
        baseQuantity = converted ?? 0;
      }
      if (baseQuantity > 0) {
        try {
          plan = planForRecipe(recipe, baseQuantity, base.id);
          productMix = requestedMix;
          unallocatedRecipeBatches = Math.max(
            0,
            plan.scaleFactor - requestedBatches
          );
          if (
            planningMode !== "finalProducts" &&
            requestedBatches > plan.scaleFactor + 1e-6
          )
            error =
              "A distribuição informada ultrapassa a quantidade de semiacabado.";
        } catch (e) {
          error = (e as Error).message;
        }
      }
    }
  }
  return json({
    recipes,
    recipe,
    plan,
    qty,
    unit,
    date,
    usage,
    baseQuantity,
    baseId,
    error,
    products,
    productMix,
    unallocatedRecipeBatches,
    planningMode,
    productChoices,
    calculationMode,
    template,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const form = (await request.formData()) as unknown as FormLike;
  try {
    const rawMix = String(form.get("productMix") || "");
    const parsedMix = rawMix ? JSON.parse(rawMix) : undefined;
    const productMix = Array.isArray(parsedMix) ? parsedMix : undefined;
    const parsedItems = JSON.parse(String(form.get("items") || "[]"));
    if (!Array.isArray(parsedItems))
      throw new Error("Receitas da OP inválidas.");
    const items = parsedItems.map((item) => ({
      recipeId: String(item.recipeId || ""),
      baseIngredientId: String(item.baseIngredientId || ""),
      baseQuantity: Number(item.baseQuantity),
      calculationMode:
        item.calculationMode === "yield"
          ? ("yield" as const)
          : ("ingredient" as const),
      targetQuantity: Number(item.targetQuantity),
      targetUnit: String(item.targetUnit || ""),
      productMix: Array.isArray(item.productMix) ? item.productMix : undefined,
    }));
    await createProductionOrderTemplate({
      templateId: String(form.get("templateId") || "") || undefined,
      name: String(form.get("name") || ""),
      recipeId: String(form.get("recipeId") || ""),
      baseIngredientId: String(form.get("baseIngredientId") || ""),
      baseQuantity: parseNumber(String(form.get("baseQuantity"))),
      items,
      notes: String(form.get("notes") || ""),
      productMix,
      unallocatedRecipeBatches: parseNumber(
        String(form.get("unallocatedRecipeBatches") || "0")
      ),
    });
    return redirect("/admin/producao/ordens");
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
  const [calculationMode, setCalculationMode] = useState<
    "ingredient" | "yield"
  >(data.calculationMode);
  type EditableItem = Omit<ProductionOrderItemSnapshot, "plan" | "version"> & {
    productMix?: ProductionPlan["productMix"];
  };
  const [items, setItems] = useState<EditableItem[]>(() => {
    const template = data.template;
    if (!template) return [];
    const snapshots = (Array.isArray(template.items) && template.items.length
      ? template.items
      : [
          {
            recipeId: template.recipeId,
            recipeName: template.recipeName,
            calculationMode: "ingredient",
            targetQuantity: template.baseQuantity,
            targetUnit: template.baseUnit,
            baseIngredientId: template.plan.baseIngredientId || "",
            baseIngredient: template.baseIngredient,
            baseQuantity: template.baseQuantity,
            baseUnit: template.baseUnit,
            plan: template.plan,
          },
        ]) as unknown as ProductionOrderItemSnapshot[];
    return snapshots.map(({ plan, ...item }) => ({
      ...item,
      productMix: plan.productMix || [],
    }));
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [unit, setUnit] = useState(data.unit);
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [showProductPlanner, setShowProductPlanner] = useState(
    data.planningMode === "finalProducts" || data.productMix.length > 0
  );
  const selectedRecipe = data.recipes.find((r) => r.id === recipeId);

  const [previewPending, setPreviewPending] = useState(false);
  useEffect(() => {
    setPreviewPending(false);
  }, [data]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const [baseId, setBaseId] = useState(data.baseId);
  useEffect(() => {
    setBaseId(data.baseId);
    setUnit(data.unit);
  }, [data.baseId, data.unit]);
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
  const error = actionData?.error || data.error;
  const blocked =
    previewPending ||
    recipeId !== data.recipe?.id ||
    !plan ||
    plan.inconsistencies.length > 0 ||
    baseId !== data.baseId ||
    Boolean(error);
  const canAddItem =
    !blocked &&
    Boolean(base) &&
    (data.planningMode === "finalProducts"
      ? data.productMix.length > 0
      : parseNumber(data.qty) > 0);
  function addCurrentItem() {
    if (!data.recipe || !base || !plan || !canAddItem) return;
    const item: EditableItem = {
      recipeId: data.recipe.id,
      recipeName: data.recipe.name,
      calculationMode,
      targetQuantity:
        data.planningMode === "finalProducts"
          ? data.baseQuantity
          : parseNumber(data.qty),
      targetUnit:
        calculationMode === "yield"
          ? "rendimentos"
          : data.planningMode === "finalProducts"
          ? base.unit
          : unit || base.unit,
      baseIngredientId: base.id,
      baseIngredient: base.name,
      baseQuantity: data.baseQuantity,
      baseUnit: base.unit,
      productMix: data.productMix,
    };
    setItems((current) =>
      editingIndex === null
        ? [...current, item]
        : current.map((entry, index) => (index === editingIndex ? item : entry))
    );
    setEditingIndex(null);
  }
  function editItem(item: EditableItem, index: number) {
    const params = new URLSearchParams({
      recipeId: item.recipeId,
      baseId: item.baseIngredientId,
      mode: item.calculationMode,
      qty: String(item.targetQuantity),
      unit: item.calculationMode === "yield" ? item.baseUnit : item.targetUnit,
      planningMode: "semiFinished",
    });
    if (data.template) params.set("templateId", data.template.id);
    item.productMix?.forEach((line) =>
      params.set(`product_${line.itemVariationId}`, String(line.quantity))
    );
    setEditingIndex(index);
    setRecipeId(item.recipeId);
    setBaseId(item.baseIngredientId);
    setCalculationMode(item.calculationMode);
    setUnit(item.calculationMode === "yield" ? item.baseUnit : item.targetUnit);
    setShowProductPlanner(Boolean(item.productMix?.length));
    setPreviewPending(true);
    submit(params, { replace: true });
  }

  return (
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/admin/producao/ordens"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
            >
              <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                <ChevronLeft size={12} />
              </span>
              ordens de produção
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">
              {data.template ? "editar OP" : "nova OP"}
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {data.template ? "Editar OP" : "Criar OP"}
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Monte a OP com uma ou mais receitas. As datas e os horários serão
              definidos no planejamento.
            </p>
          </div>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
          <Card className="h-fit space-y-5 rounded-2xl border-slate-200 bg-white p-5 shadow-none">
            <Form method="get" ref={formRef} className="space-y-5">
              {data.template && (
                <input
                  type="hidden"
                  name="templateId"
                  value={data.template.id}
                />
              )}
              <input
                type="hidden"
                name="planningMode"
                value={data.planningMode}
                readOnly
              />
              <input type="hidden" name="recipeId" value={recipeId} />
              <input type="hidden" name="mode" value={calculationMode} />
              <input
                type="hidden"
                name="baseId"
                value={recipeId === data.recipe?.id ? baseId : ""}
              />
              <input
                type="hidden"
                name="unit"
                value={unit || (recipeId === data.recipe?.id ? data.unit : "")}
              />
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">
                  Como deseja planejar?
                </Label>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant={
                      data.planningMode === "finalProducts"
                        ? "default"
                        : "outline"
                    }
                    className="h-auto min-h-10 whitespace-normal rounded-lg text-sm"
                    onClick={() => {
                      setShowProductPlanner(true);
                      if (!recipeId) {
                        const params = new URLSearchParams({
                          planningMode: "finalProducts",
                        });
                        if (data.template)
                          params.set("templateId", data.template.id);
                        setPreviewPending(true);
                        submit(params, { replace: true });
                      } else {
                        const params = new URLSearchParams(
                          new FormData(formRef.current!) as any
                        );
                        params.set("planningMode", "finalProducts");
                        setPreviewPending(true);
                        submit(params, { replace: true });
                      }
                    }}
                  >
                    Sei quais itens quero produzir
                  </Button>
                  <Button
                    type="button"
                    variant={
                      data.planningMode !== "finalProducts"
                        ? "default"
                        : "outline"
                    }
                    className="h-auto min-h-10 whitespace-normal rounded-lg text-sm"
                    onClick={() => {
                      const params = new URLSearchParams(
                        new FormData(formRef.current!) as any
                      );
                      params.set("planningMode", "semiFinished");
                      setPreviewPending(true);
                      submit(params, { replace: true });
                    }}
                  >
                    Partir da receita e do ingrediente-base
                  </Button>
                </div>
              </div>
              {data.planningMode === "finalProducts" && !recipeId && (
                <Dialog
                  open={productPickerOpen}
                  onOpenChange={setProductPickerOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-11 w-full justify-between gap-3 rounded-lg text-left text-sm"
                    >
                      Buscar o primeiro item{" "}
                      <ChevronsUpDown className="h-5 w-5 shrink-0" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Escolha um item para começar</DialogTitle>
                      <DialogDescription>
                        Depois você poderá acrescentar outros itens que usem a
                        mesma receita.
                      </DialogDescription>
                    </DialogHeader>
                    <Command className="min-h-0">
                      <CommandInput placeholder="Buscar item ou receita" />
                      <CommandList className="max-h-[50vh]">
                        <CommandEmpty>
                          Nenhum item com receita encontrado nas fichas de custo
                          ativas.
                        </CommandEmpty>
                        {data.productChoices
                          .filter((choice) =>
                            data.recipes.some((r) => r.id === choice.recipeId)
                          )
                          .map((choice) => {
                            const recipe = data.recipes.find(
                              (r) => r.id === choice.recipeId
                            )!;
                            return (
                              <CommandItem
                                key={`${choice.itemVariationId}:${choice.recipeId}`}
                                value={`${choice.itemVariationId}:${choice.recipeId}`}
                                keywords={[
                                  choice.itemName,
                                  choice.variationName,
                                  recipe.name,
                                ]}
                                className="min-h-14 text-lg"
                                onSelect={() => {
                                  const params = new URLSearchParams({
                                    planningMode: "finalProducts",
                                    recipeId: choice.recipeId,
                                  });
                                  if (data.template)
                                    params.set("templateId", data.template.id);
                                  params.set(
                                    `product_${choice.itemVariationId}`,
                                    "1"
                                  );
                                  setRecipeId(choice.recipeId);
                                  setBaseId("");
                                  setUnit("");
                                  setShowProductPlanner(true);
                                  setProductPickerOpen(false);
                                  setPreviewPending(true);
                                  submit(params, { replace: true });
                                }}
                              >
                                <span>
                                  {choice.itemName} · {choice.variationName}
                                  <span className="block text-sm text-muted-foreground">
                                    Receita: {recipe.name}
                                  </span>
                                </span>
                              </CommandItem>
                            );
                          })}
                      </CommandList>
                    </Command>
                  </DialogContent>
                </Dialog>
              )}
              {(data.planningMode !== "finalProducts" || recipeId) && (
                <div className="space-y-2">
                  <Label
                    id="production-recipe-label"
                    className="text-sm font-semibold text-slate-900"
                  >
                    1. Receita
                  </Label>
                  <Dialog
                    open={recipePickerOpen}
                    onOpenChange={setRecipePickerOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        aria-labelledby="production-recipe-label production-recipe-value"
                        className="h-auto min-h-11 w-full justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium"
                      >
                        <span
                          id="production-recipe-value"
                          className={cn(
                            "min-w-0 whitespace-normal break-words",
                            !selectedRecipe && "text-muted-foreground"
                          )}
                        >
                          {selectedRecipe?.name || "Buscar e escolher receita"}
                        </span>
                        <ChevronsUpDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:flex [&>button:last-child]:h-10 [&>button:last-child]:w-10 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
                      <DialogHeader className="shrink-0 px-6 pb-4 pt-6 pr-16 text-left">
                        <DialogTitle className="text-2xl">
                          Escolher receita
                        </DialogTitle>
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
                          <CommandEmpty>
                            Nenhuma receita encontrada. Tente outro nome.
                          </CommandEmpty>
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
                                <span className="block font-medium">
                                  {r.name}
                                </span>
                                {r.status === "draft" && (
                                  <span className="text-sm text-muted-foreground">
                                    Rascunho
                                  </span>
                                )}
                              </span>
                              {r.id === recipeId && (
                                <Check
                                  className="h-6 w-6 shrink-0 text-emerald-600"
                                  aria-label="Receita selecionada"
                                />
                              )}
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
              )}

              {data.recipe && recipeId === data.recipe.id && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-900">
                    2. Como deseja calcular?
                  </Label>
                  <Select
                    value={calculationMode}
                    onValueChange={(value: "ingredient" | "yield") => {
                      setCalculationMode(value);
                      setUnit("");
                      setTimeout(() => refresh(), 0);
                    }}
                  >
                    <SelectTrigger className="h-11 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingredient">
                        Quantidade de ingrediente
                      </SelectItem>
                      {Number(data.recipe.yieldQuantity) > 0 && (
                        <SelectItem value="yield">
                          Número de rendimentos
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {data.recipe &&
                recipeId === data.recipe.id &&
                calculationMode === "ingredient" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-900">
                      3. Ingrediente-base
                    </Label>
                    <Select
                      value={baseId}
                      onValueChange={(v) => {
                        setPreviewPending(true);
                        setBaseId(v);
                        setUnit("");
                        setTimeout(() => refresh(), 0);
                      }}
                    >
                      <SelectTrigger className="h-11 text-sm">
                        <SelectValue placeholder="Qual ingrediente define a quantidade?" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.recipe.ingredients.map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              {base && (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant={showProductPlanner ? "secondary" : "outline"}
                    className="h-10 w-full justify-start gap-2 rounded-lg text-sm"
                    onClick={() => setShowProductPlanner((value) => !value)}
                  >
                    <PackageOpen className="h-5 w-5" />
                    {showProductPlanner
                      ? "Ocultar planejamento por produtos"
                      : "Planejar pelos itens que usam esta receita"}
                  </Button>

                  {showProductPlanner && (
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-sm text-muted-foreground">
                        Informe a quantidade de cada item que deseja produzir
                        com esta receita.
                      </p>
                      {data.products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum produto com ficha de custo ativa usa esta
                          receita.
                        </p>
                      ) : (
                        data.products.map((product) => {
                          const selected = data.productMix.find(
                            (line) =>
                              line.itemVariationId === product.itemVariationId
                          );
                          return (
                            <div
                              key={product.itemVariationId}
                              className="space-y-1"
                            >
                              <Label
                                htmlFor={`product_${product.itemVariationId}`}
                              >
                                {product.itemName} · {product.variationName}
                              </Label>
                              <div className="flex items-center gap-3">
                                <Input
                                  key={`${product.itemVariationId}-${editingIndex}`}
                                  id={`product_${product.itemVariationId}`}
                                  name={`product_${product.itemVariationId}`}
                                  inputMode="numeric"
                                  min="0"
                                  step="1"
                                  disabled={
                                    product.recipeBatchesPerUnit == null
                                  }
                                  defaultValue={selected?.quantity || ""}
                                  className="h-14 text-2xl font-semibold"
                                  onChange={() => refresh(350)}
                                />
                                <span className="shrink-0 text-sm text-muted-foreground">
                                  un.
                                </span>
                              </div>
                              {product.recipeBatchesPerUnit == null && (
                                <p className="text-sm text-destructive">
                                  Ajuste a unidade de consumo desta receita na
                                  ficha de custo.
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {data.planningMode !== "finalProducts" && (
                    <div className="space-y-2">
                      <Label className="text-lg">
                        3.{" "}
                        {calculationMode === "yield"
                          ? "Número de rendimentos"
                          : `Quantidade de ${base.name}`}
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          key={`${data.recipe?.id}-${editingIndex}-${data.calculationMode}`}
                          name="qty"
                          inputMode="decimal"
                          defaultValue={data.qty}
                          placeholder="0"
                          className="h-12 text-xl font-semibold tabular-nums"
                          onChange={() => refresh(400)}
                        />
                        {calculationMode === "ingredient" && (
                          <Select
                            value={unit || base.unit}
                            onValueChange={(v) => {
                              setPreviewPending(true);
                              setUnit(v);
                              setTimeout(() => refresh(), 0);
                            }}
                          >
                            <SelectTrigger className="h-12 w-28 text-base font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u.toLowerCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={!canAddItem}
                onClick={addCurrentItem}
                className="h-10 w-full rounded-lg text-sm"
              >
                <Plus className="mr-2 h-5 w-5" />{" "}
                {editingIndex === null
                  ? "Adicionar receita à OP"
                  : "Atualizar receita"}
              </Button>
              {editingIndex !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingIndex(null)}
                >
                  Cancelar edição da receita
                </Button>
              )}
            </Form>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription className="text-base">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Form method="post" className="space-y-4">
              {data.template && (
                <input
                  type="hidden"
                  name="templateId"
                  value={data.template.id}
                />
              )}
              <input type="hidden" name="items" value={JSON.stringify(items)} />
              <input type="hidden" name="recipeId" value={recipeId} />
              <input
                type="hidden"
                name="baseIngredientId"
                value={data.baseId}
              />
              <input
                type="hidden"
                name="baseQuantity"
                value={data.baseQuantity}
              />
              <input
                type="hidden"
                name="productMix"
                value={JSON.stringify(data.productMix)}
              />
              <input
                type="hidden"
                name="unallocatedRecipeBatches"
                value={data.unallocatedRecipeBatches}
              />
              <Input
                name="name"
                defaultValue={data.template?.name || ""}
                placeholder="Nome da OP (opcional)"
                className="h-10 text-sm"
              />
              <Input
                name="notes"
                defaultValue={data.template?.notes || ""}
                placeholder="Observações (opcional)"
                className="h-10 text-sm"
              />
              <Button
                type="submit"
                disabled={
                  items.length === 0 ||
                  editingIndex !== null ||
                  navigation.state !== "idle"
                }
                className="h-10 bg-slate-900 px-5 text-sm font-semibold hover:bg-slate-700"
              >
                {data.template ? "Salvar alterações" : "Criar OP"}
              </Button>
              {editingIndex !== null && (
                <p className="text-sm text-muted-foreground">
                  Atualize a receita selecionada antes de salvar a OP.
                </p>
              )}
            </Form>
          </Card>

          <div className="space-y-4">
            {items.length > 0 && (
              <Card className="space-y-3 rounded-2xl border-slate-200 bg-white p-5 shadow-none">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Receitas da OP
                  </h2>
                  <p className="text-sm text-slate-500">
                    As datas serão definidas depois, ao planejar a OP.
                  </p>
                </div>
                {items.map((item, index) => (
                  <div
                    key={`${item.recipeId}-${index}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <div className="font-semibold">{item.recipeName}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.calculationMode === "yield"
                          ? `${item.targetQuantity} ${item.targetUnit}`
                          : `${
                              item.targetQuantity
                            } ${item.targetUnit.toLowerCase()} de ${
                              item.baseIngredient
                            }`}
                      </div>
                    </div>
                    <div className="flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${item.recipeName}`}
                        onClick={() => editItem(item, index)}
                      >
                        <Pencil className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${item.recipeName}`}
                        onClick={() => {
                          setItems((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index
                            )
                          );
                          setEditingIndex(null);
                        }}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
            {!plan && (
              <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-500 shadow-none">
                Escolha a receita, o ingrediente-base e a quantidade para ver o
                que será necessário.
              </Card>
            )}
            {plan && data.recipe && (
              <>
                <Card className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-slate-200 bg-white p-5 shadow-none">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Produzir
                    </div>
                    <div className="text-xl font-semibold text-slate-950">
                      {data.recipe.name}
                    </div>
                  </div>
                  {base && (
                    <div className="text-right">
                      <div className="text-sm text-slate-500">
                        Ingrediente principal · {base.name}
                      </div>
                      <Quantity
                        quantity={data.baseQuantity}
                        unit={base.unit}
                        className="text-3xl"
                      />
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

                <Card className="space-y-4 rounded-2xl border-slate-200 bg-white p-5 shadow-none">
                  <h3 className="text-base font-semibold text-slate-950">
                    Ingredientes desta produção
                  </h3>
                  <IngredientList lines={plan.totals} />
                  <p className="text-sm text-slate-500">
                    Na próxima etapa você informa se há preparações
                    intermediárias (biga, poolish, autólise…).
                  </p>
                </Card>
                {showProductPlanner && data.products.length > 0 && (
                  <Card className="space-y-4 rounded-2xl border-slate-200 bg-white p-5 shadow-none">
                    <h3 className="text-base font-semibold text-slate-950">
                      Rendimento por produto
                    </h3>
                    <div className="space-y-3">
                      {data.products.map((product) => {
                        const selected = data.productMix.find(
                          (line) =>
                            line.itemVariationId === product.itemVariationId
                        );
                        const possible = product.recipeBatchesPerUnit
                          ? Math.floor(
                              plan.scaleFactor / product.recipeBatchesPerUnit
                            )
                          : 0;
                        return (
                          <div
                            key={product.itemVariationId}
                            className="flex items-center justify-between gap-4 rounded-lg border p-4"
                          >
                            <div>
                              <div className="font-semibold">
                                {product.itemName} · {product.variationName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Rendimento se usar todo o lote: {possible} un.
                              </div>
                            </div>
                            <div className="text-right text-xl font-bold">
                              {selected?.quantity || 0} un.
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between border-t pt-4 text-lg">
                      <span>Sobra sem destino</span>
                      <strong>
                        {data.unallocatedRecipeBatches.toLocaleString("pt-BR", {
                          maximumFractionDigits: 3,
                        })}{" "}
                        lote(s)
                        {base && data.unallocatedRecipeBatches > 0
                          ? ` · ${(
                              data.unallocatedRecipeBatches * base.quantity
                            ).toLocaleString("pt-BR", {
                              maximumFractionDigits: 2,
                            })} ${base.unit.toLowerCase()}`
                          : ""}
                      </strong>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
