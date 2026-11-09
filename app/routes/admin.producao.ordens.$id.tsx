import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Check, Lock, Play } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { authenticator } from "~/domain/auth/google.server";
import {
  FINAL_COLOR,
  IngredientList,
  OrderStatusBadge,
  Quantity,
  STEP_COLORS,
  STEP_STATUS_LABEL,
} from "~/domain/production/components/production-ui";
import {
  applyOrderAction,
  definePreparations,
  getPreparationSuggestions,
  getProductionOrder,
  type FormLike,
} from "~/domain/production/production-order.server";
import {
  PreparationsEditor,
  type PreparationSuggestion,
} from "~/domain/production/components/preparations-editor";
import { cn } from "~/lib/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  // A tela inteira depende da OP para renderizar.
  const order = await getProductionOrder(String(params.id));
  const suggestions = await getPreparationSuggestions(order);
  return json({ order, suggestions }, { headers: { "Cache-Control": "no-store" } });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const form = (await request.formData()) as unknown as FormLike;
  try {
    if (form.get("intent") === "define-preparations") {
      const body = JSON.parse(String(form.get("payload") || "{}"));
      await definePreparations(
        String(params.id),
        (body.preparations || []).map((p: any) => ({
          name: String(p.name || ""),
          ingredients: (p.lines || []).map((l: any) => ({
            recipeIngredientId: String(l.recipeIngredientId),
            quantity: Number(l.quantity),
            unit: String(l.unit),
          })),
        })),
        { saveToRecipe: body.saveToRecipe === true }
      );
      return redirect(new URL(request.url).pathname);
    }
    await applyOrderAction(String(params.id), form);
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 400 });
  }
  const next = String(form.get("next") || "");
  return redirect(next ? `?step=${next}` : new URL(request.url).pathname);
}

function fmt(date: string | null) {
  return date ? format(new Date(date), "dd/MM/yyyy HH:mm") : "—";
}

export default function ProductionOrderDetail() {
  const { order, suggestions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const busy = navigation.state !== "idle";
  const { plan, Steps: steps } = order;

  // Fase 2: antes de iniciar, o operador informa se há preparações intermediárias.
  const editing = params.get("preparacoes") === "editar";
  if (order.status === "planned" && (plan.preparationsDefined === false || editing)) {
    return (
      <div className="w-full space-y-6 p-4 md:p-6 2xl:p-10">
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild variant="outline" className="h-14 w-14">
            <Link to="/admin/producao/ordens" aria-label="Voltar"><ArrowLeft className="h-6 w-6" /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-semibold text-muted-foreground">OP #{order.number} · {editing ? "editar preparações" : "fase 2 de 2"}</div>
            <h1 className="truncate text-3xl font-bold 2xl:text-5xl">{order.recipeName}</h1>
          </div>
          <Quantity quantity={order.baseQuantity} unit={order.baseUnit} className="text-4xl" />
        </div>
        {actionData?.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="text-lg">{actionData.error}</AlertDescription>
          </Alert>
        )}
        <PreparationsEditor
          totals={plan.totals}
          suggestions={suggestions as PreparationSuggestion[]}
          busy={busy}
          canSaveToRecipe={Boolean(order.recipeId && plan.baseIngredientId)}
          cancelHref={editing ? "?" : undefined}
        />
      </div>
    );
  }

  const running = order.status === "in_progress";
  const stepIndex = (id: string) => steps.findIndex((s) => s.id === id);
  const firstOpen = steps.find((s) => s.status !== "done") ?? steps[steps.length - 1];
  const current =
    steps.find((s) => s.id === params.get("step")) ??
    steps.find((s) => s.status === "in_progress") ??
    firstOpen;
  const finalStep = steps.find((s) => s.kind === "final");
  const prepsDone = steps.filter((s) => s.kind === "preparation").every((s) => s.status === "done");
  const allDone = steps.every((s) => s.status === "done");
  const nextStep = steps.find((s) => s.id !== current.id && s.status !== "done" && stepIndex(s.id) > stepIndex(current.id))
    ?? steps.find((s) => s.id !== current.id && s.status !== "done");

  const colorFor = (s: (typeof steps)[number]) =>
    s.kind === "final" ? FINAL_COLOR : STEP_COLORS[s.sortOrder % STEP_COLORS.length];
  const blocked = (s: (typeof steps)[number]) => s.kind === "final" && !prepsDone;

  const currentPrep = plan.preparations.find((p) => p.id === current.preparationId);
  const currentColor = colorFor(current);

  return (
    <div className="w-full space-y-6 p-4 md:p-6 2xl:p-10">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="outline" className="h-14 w-14">
          <Link to="/admin/producao/ordens" aria-label="Voltar">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-semibold text-muted-foreground">OP #{order.number}</div>
          <h1 className="truncate text-3xl font-bold 2xl:text-5xl">{order.recipeName}</h1>
        </div>
        <OrderStatusBadge status={order.status} className="text-xl" />
      </div>

      {actionData?.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="text-lg">{actionData.error}</AlertDescription>
        </Alert>
      )}
      {plan.inconsistencies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="text-lg">
            Inconsistência na receita: {plan.inconsistencies.join(" ")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,1fr)_2fr] xl:grid-cols-[minmax(18rem,1fr)_2fr_minmax(20rem,1fr)]">
        {/* Esquerda: etapas */}
        <div className="space-y-4">
          {steps.map((step) => {
            const color = colorFor(step);
            const isCurrent = step.id === current.id;
            const isBlocked = blocked(step);
            return (
              <Link
                key={step.id}
                to={`?step=${step.id}`}
                replace
                preventScrollReset
                className="block"
              >
                <Card
                  className={cn(
                    "overflow-hidden border-2 transition active:scale-[0.99]",
                    isCurrent ? "ring-4 ring-primary/60" : "",
                    step.status === "done" ? "bg-emerald-50 border-emerald-300" : color.soft,
                    isBlocked && "opacity-60"
                  )}
                >
                  <div className={cn("h-2", color.bar)} />
                  <div className="flex items-center justify-between gap-3 p-5">
                    <div>
                      <div className="text-2xl font-bold">{step.name}</div>
                      <div className="mt-1 text-lg font-medium">
                        {isBlocked
                          ? "Bloqueada até concluir as preparações"
                          : STEP_STATUS_LABEL[step.status]}
                      </div>
                    </div>
                    {step.status === "done" ? (
                      <Check className="h-10 w-10 shrink-0 text-emerald-600" />
                    ) : isBlocked ? (
                      <Lock className="h-8 w-8 shrink-0" />
                    ) : step.status === "in_progress" ? (
                      <Play className="h-8 w-8 shrink-0 text-amber-600" />
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Centro: etapa atual */}
        <Card className={cn("space-y-5 border-2 p-6", currentColor.soft)}>
          <div className={cn("-mx-6 -mt-6 h-3", currentColor.bar)} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-4xl font-bold">{current.name}</h2>
            <span className="rounded-full bg-background px-4 py-1.5 text-lg font-semibold">
              {STEP_STATUS_LABEL[current.status]}
            </span>
          </div>

          {current.kind === "preparation" && currentPrep && (
            <>
              <p className="text-xl font-medium">Pesar agora:</p>
              <IngredientList lines={currentPrep.ingredients} />
              {currentPrep.notes && <p className="text-lg text-muted-foreground">{currentPrep.notes}</p>}
            </>
          )}
          {current.kind === "final" && (
            <>
              {plan.final.preparedItems.length > 0 && (
                <>
                  <p className="text-xl font-medium">Utilizar:</p>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {plan.final.preparedItems.map((name, i) => (
                      <li
                        key={name}
                        className={cn("flex items-center gap-3 rounded-xl border-2 px-5 py-4 text-2xl font-semibold", STEP_COLORS[i % STEP_COLORS.length].soft)}
                      >
                        <Check className="h-6 w-6" /> {name} preparado
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xl font-medium">
                {plan.final.preparedItems.length > 0 ? "Adicionar:" : "Pesar agora:"}
              </p>
              <IngredientList lines={plan.final.ingredients} />
            </>
          )}

          {running && !blocked(current) && (
            <Form method="post" className="grid gap-3 pt-2 sm:grid-cols-2">
              <input type="hidden" name="intent" value="step" />
              <input type="hidden" name="stepId" value={current.id} />
              {current.status === "pending" && (
                <Button name="to" value="in_progress" disabled={busy} className="h-24 text-2xl sm:col-span-2">
                  <Play className="mr-3 h-7 w-7" /> Iniciar etapa
                </Button>
              )}
              {current.status === "in_progress" && (
                <>
                  <Button name="to" value="done" disabled={busy} className="h-24 bg-emerald-600 text-2xl hover:bg-emerald-700 sm:col-span-2">
                    <Check className="mr-3 h-7 w-7" /> Marcar como concluída
                  </Button>
                </>
              )}
              {current.status === "done" && (
                <Button name="to" value="pending" variant="outline" disabled={busy} className="h-20 text-xl sm:col-span-2">
                  Reabrir etapa
                </Button>
              )}
            </Form>
          )}
          {!running && order.status === "planned" && (
            <p className="text-lg text-muted-foreground">Toque em “Iniciar produção” para começar.</p>
          )}
          {nextStep && running && current.status === "done" && (
            <Button asChild variant="secondary" className="h-20 w-full text-xl">
              <Link to={`?step=${nextStep.id}`} replace>
                Próxima: {nextStep.name} →
              </Link>
            </Button>
          )}
        </Card>

        {/* Direita: resumo e ações */}
        <div className="space-y-4 lg:col-span-2 xl:col-span-1">
          <Card className="space-y-4 p-6">
            <div>
              <div className="text-lg text-muted-foreground">Ingrediente principal · {order.baseIngredient}</div>
              <Quantity quantity={order.baseQuantity} unit={order.baseUnit} className="text-6xl" />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-lg xl:grid-cols-1">
              <div><dt className="text-muted-foreground">Produzir em</dt><dd className="font-semibold">{format(new Date(order.productionDate), "dd/MM/yyyy")}</dd></div>
              {order.usageDate && <div><dt className="text-muted-foreground">Usar em</dt><dd className="font-semibold">{format(new Date(order.usageDate), "dd/MM/yyyy")}</dd></div>}
              <div><dt className="text-muted-foreground">Criada em</dt><dd className="font-semibold">{fmt(order.createdAt)}</dd></div>
              <div><dt className="text-muted-foreground">Início</dt><dd className="font-semibold">{fmt(order.startedAt)}</dd></div>
              <div><dt className="text-muted-foreground">Finalização</dt><dd className="font-semibold">{fmt(order.finishedAt)}</dd></div>
              {order.producedQuantity != null && (
                <div><dt className="text-muted-foreground">Produzido</dt><dd className="font-semibold">{order.producedQuantity} {order.producedUnit}</dd></div>
              )}
              {order.notes && <div className="col-span-2 xl:col-span-1"><dt className="text-muted-foreground">Observações</dt><dd>{order.notes}</dd></div>}
            </dl>
          </Card>

          {order.status === "planned" && (
            <Button asChild variant="outline" className="h-16 w-full text-xl">
              <Link to="?preparacoes=editar">Editar preparações</Link>
            </Button>
          )}
          {order.status === "planned" && (
            <Form method="post">
              <input type="hidden" name="intent" value="start" />
              <Button disabled={busy} className="h-24 w-full text-2xl">
                <Play className="mr-3 h-7 w-7" /> Iniciar produção
              </Button>
            </Form>
          )}

          {running && (
            <Card className="space-y-4 p-6">
              {finalStep && !allDone && (
                <p className="text-lg text-muted-foreground">
                  Conclua todas as etapas para finalizar.
                </p>
              )}
              <Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="finish" />
                <div className="flex gap-3">
                  <Input name="producedQuantity" inputMode="decimal" placeholder="Qtd. produzida (opcional)" className="h-16 text-xl" />
                  <Input name="producedUnit" placeholder="un / kg" className="h-16 w-28 text-xl" />
                </div>
                <Button disabled={busy || !allDone} className="h-24 w-full bg-emerald-600 text-2xl hover:bg-emerald-700">
                  Finalizar produção
                </Button>
              </Form>
            </Card>
          )}

          {(order.status === "planned" || running) && (
            <Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <Button variant="outline" disabled={busy} className="h-16 w-full text-lg text-destructive">
                Cancelar produção
              </Button>
            </Form>
          )}

          <Card className="space-y-3 p-6">
            <h3 className="text-xl font-bold">Todos os ingredientes</h3>
            <ul className="space-y-1 text-lg">
              {plan.totals.map((t) => (
                <li key={t.id} className="flex justify-between gap-3">
                  <span>{t.name}</span>
                  <Quantity quantity={t.quantity} unit={t.unit} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
