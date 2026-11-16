import {
  defer,
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { format } from "date-fns";
import { Archive, ExternalLink, Plus } from "lucide-react";
import { Suspense } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { authenticator } from "~/domain/auth/google.server";
import {
  OrderStatusBadge,
  Quantity,
} from "~/domain/production/components/production-ui";
import {
  launchProductionOrderTemplate,
  listProductionOrderTemplates,
  setProductionOrderTemplateArchived,
  type FormLike,
} from "~/domain/production/production-order.server";

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  return defer({ templates: listProductionOrderTemplates() });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const form = (await request.formData()) as unknown as FormLike;
  const templateId = String(form.get("templateId") || "");
  try {
    if (form.get("intent") === "archive") {
      await setProductionOrderTemplateArchived(templateId, true);
      return redirect("/admin/producao/ordens");
    }
    const rawDate = String(form.get("date") || "");
    const launch = await launchProductionOrderTemplate({
      templateId,
      productionDate: new Date(`${rawDate}T12:00:00-03:00`),
    });
    return redirect(`/admin/producao/ordens/${launch.id}`);
  } catch (error) {
    return json({ error: (error as Error).message }, { status: 400 });
  }
}

export default function ProductionOrdersIndex() {
  const { templates } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  return (
    <div className="w-full space-y-6 p-4 md:p-6 2xl:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold 2xl:text-4xl">
            Ordens de produção
          </h1>
          <p className="mt-1 text-lg text-muted-foreground">
            Cadastre uma OP uma vez e lance-a nos dias necessários.
          </p>
        </div>
        <Button asChild size="lg" className="h-16 px-8 text-xl">
          <Link to="/admin/producao/ordens/new">
            <Plus className="mr-2 h-6 w-6" /> Cadastrar OP
          </Link>
        </Button>
      </div>
      {actionData?.error && (
        <Alert variant="destructive">
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}
      <Suspense
        fallback={
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        }
      >
        <Await
          resolve={templates}
          errorElement={
            <p className="text-destructive">Erro ao carregar as OPs.</p>
          }
        >
          {(list) =>
            list.length === 0 ? (
              <Card className="p-12 text-center text-xl text-muted-foreground">
                Nenhuma OP cadastrada.
              </Card>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {list.map((template) => (
                  <Card key={template.id} className="space-y-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          OP cadastrada #{template.number}
                        </div>
                        <h2 className="text-3xl font-bold">{template.name}</h2>
                        {template.name !== template.recipeName && (
                          <p className="text-muted-foreground">
                            Receita: {template.recipeName}
                          </p>
                        )}
                      </div>
                      <Quantity
                        quantity={template.baseQuantity}
                        unit={template.baseUnit}
                        className="text-3xl"
                      />
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <div className="text-sm text-muted-foreground">
                        Ingrediente principal
                      </div>
                      <div className="text-lg font-semibold">
                        {template.baseIngredient}
                      </div>
                    </div>
                    <Form
                      method="post"
                      className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
                    >
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <div className="min-w-48 flex-1 space-y-2">
                        <Label
                          htmlFor={`date-${template.id}`}
                          className="text-base"
                        >
                          Lançar para o dia
                        </Label>
                        <Input
                          id={`date-${template.id}`}
                          name="date"
                          type="date"
                          required
                          defaultValue={today()}
                          className="h-14 text-lg"
                        />
                      </div>
                      <Button disabled={busy} className="h-14 px-7 text-lg">
                        Lançar OP
                      </Button>
                    </Form>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">
                          Últimos lançamentos ({template._count.Launches})
                        </h3>
                        <Form method="post">
                          <input type="hidden" name="intent" value="archive" />
                          <input
                            type="hidden"
                            name="templateId"
                            value={template.id}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            className="text-muted-foreground"
                          >
                            <Archive className="mr-2 h-4 w-4" /> Arquivar
                          </Button>
                        </Form>
                      </div>
                      {template.Launches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Ainda não lançada.
                        </p>
                      ) : (
                        template.Launches.map((launch) => (
                          <Link
                            key={launch.id}
                            to={`/admin/producao/ordens/${launch.id}`}
                            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted"
                          >
                            <span className="font-medium">
                              Execução #{launch.number} ·{" "}
                              {format(
                                new Date(launch.productionDate),
                                "dd/MM/yyyy"
                              )}
                            </span>
                            <span className="flex items-center gap-2">
                              <OrderStatusBadge status={launch.status} />
                              <ExternalLink className="h-4 w-4" />
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )
          }
        </Await>
      </Suspense>
    </div>
  );
}
