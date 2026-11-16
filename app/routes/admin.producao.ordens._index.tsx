import { defer, json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { format } from "date-fns";
import { Archive, ChevronLeft, ExternalLink, PlusCircle } from "lucide-react";
import { Suspense } from "react";
import Container from "~/components/layout/container/container";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { authenticator } from "~/domain/auth/google.server";
import { OrderStatusBadge, Quantity } from "~/domain/production/components/production-ui";
import { launchProductionOrderTemplate, listProductionOrderTemplates, setProductionOrderTemplateArchived, type FormLike } from "~/domain/production/production-order.server";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) return redirect("/login");
  return defer({ templates: listProductionOrderTemplates() });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) return redirect("/login");
  const form = (await request.formData()) as unknown as FormLike;
  const templateId = String(form.get("templateId") || "");
  try {
    if (form.get("intent") === "archive") {
      await setProductionOrderTemplateArchived(templateId, true);
      return redirect("/admin/producao/ordens");
    }
    const rawDate = String(form.get("date") || "");
    const launch = await launchProductionOrderTemplate({ templateId, productionDate: new Date(`${rawDate}T12:00:00-03:00`) });
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
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link to="/admin/producao" className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950">
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500"><ChevronLeft size={12} /></span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">produção</span>
            </div>
            <Link to="/admin/producao/ordens/new" className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-blue-500">
              <PlusCircle size={15} /> Cadastrar OP
            </Link>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Ordens de produção</h1>
            <p className="max-w-3xl text-sm text-slate-500">Cadastre uma OP uma vez e lance-a nos dias necessários.</p>
          </div>
        </section>

        {actionData?.error && <Alert variant="destructive"><AlertDescription>{actionData.error}</AlertDescription></Alert>}

        <Suspense fallback={<ProductionOrdersLoading />}>
          <Await resolve={templates} errorElement={<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar as ordens de produção.</div>}>
            {(list) => (
              <div className="flex flex-col gap-4">
                <div className="border-b border-slate-200 pb-4 text-sm text-slate-600">{list.length} ordem(ns) cadastrada(s).</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <Table className="min-w-[1050px]">
                    <TableHeader className="bg-slate-50/90">
                      <TableRow className="hover:bg-slate-50/90">
                        {["Ordem de produção", "Receita e ingrediente", "Quantidade base", "Últimos lançamentos", "Lançar OP"].map((heading) => (
                          <TableHead key={heading} className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</TableHead>
                        ))}
                        <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.length === 0 ? (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="px-4 py-8 text-sm text-slate-500">Nenhuma OP cadastrada.</TableCell></TableRow>
                      ) : list.map((template) => (
                        <TableRow key={template.id} className="border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="px-4 py-3">
                            <div className="flex flex-col gap-0.5"><span className="font-semibold text-slate-900">{template.name}</span><span className="text-xs text-slate-500">OP cadastrada #{template.number}</span></div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex flex-col gap-0.5"><span className="text-sm font-medium text-slate-700">{template.recipeName}</span><span className="text-xs text-slate-500">{template.baseIngredient}</span></div>
                          </TableCell>
                          <TableCell className="px-4 py-3"><Quantity quantity={template.baseQuantity} unit={template.baseUnit} className="text-sm font-semibold" /></TableCell>
                          <TableCell className="px-4 py-3">
                            {template.Launches.length === 0 ? <span className="text-sm text-slate-400">Ainda não lançada</span> : (
                              <div className="flex flex-col gap-1.5">
                                {template.Launches.map((launch) => (
                                  <Link key={launch.id} to={`/admin/producao/ordens/${launch.id}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-950 hover:underline">
                                    <span>#{launch.number} · {format(new Date(launch.productionDate), "dd/MM/yyyy")}</span><OrderStatusBadge status={launch.status} /><ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                  </Link>
                                ))}
                                <span className="text-xs text-slate-400">{template._count.Launches} no total</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Form method="post" className="flex items-end gap-2">
                              <input type="hidden" name="templateId" value={template.id} />
                              <div className="space-y-1"><Label htmlFor={`date-${template.id}`} className="text-xs text-slate-500">Dia</Label><Input id={`date-${template.id}`} name="date" type="date" required defaultValue={today()} className="h-9 w-36 text-sm" /></div>
                              <Button disabled={busy} size="sm" className="h-9">Lançar</Button>
                            </Form>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <Form method="post">
                              <input type="hidden" name="intent" value="archive" /><input type="hidden" name="templateId" value={template.id} />
                              <Button variant="ghost" size="sm" disabled={busy} className="text-slate-500 hover:bg-red-50 hover:text-red-600"><Archive className="mr-2 h-4 w-4" /> Arquivar</Button>
                            </Form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Await>
        </Suspense>
      </div>
    </Container>
  );
}

function ProductionOrdersLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Skeleton className="h-10 w-full rounded-none" />
        {[0, 1, 2, 3].map((row) => <div key={row} className="grid grid-cols-6 gap-4 border-t border-slate-100 px-4 py-4">{Array.from({ length: 6 }).map((_, column) => <Skeleton key={column} className="h-8 w-full" />)}</div>)}
      </div>
    </div>
  );
}
