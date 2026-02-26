import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { variationPrismaEntity } from "~/domain/item/variation.prisma.entity.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function str(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Id da variação não informado");

    const variation = await variationPrismaEntity.findById(id);
    if (!variation || variation.deletedAt) {
      return badRequest("Variação não encontrada");
    }

    return ok({ variation });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Id da variação não informado");

    const formData = await request.formData();
    const action = str(formData.get("_action"));

    if (action === "variation-update") {
      await variationPrismaEntity.update(id, {
        kind: str(formData.get("kind")),
        code: str(formData.get("code")),
        name: str(formData.get("name")),
      });

      return ok({ message: "Variação atualizada com sucesso" });
    }

    if (action === "variation-delete") {
      await variationPrismaEntity.softDelete(id);
      return redirect("/admin/variations");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVariationDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const variation = loaderData?.payload?.variation as any;
  const actionMessage = actionData?.message || actionData?.payload?.message;

  if (!variation) {
    return <div className="p-4 text-sm text-slate-500">Variação não encontrada.</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Variação</h1>
            <p className="text-xs text-slate-500">Edite os dados do catálogo global de variações.</p>
          </div>
          <Link to="/admin/variations" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
            <ChevronLeft size={14} />
            Voltar para lista
          </Link>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <CardTitle>{variation.name}</CardTitle>
            <Badge variant="outline" className="border-slate-200 bg-white font-mono text-xs text-slate-700">
              {variation.kind}
            </Badge>
          </div>
          <p className="text-xs text-slate-500">ID: {variation.id}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!!actionMessage && (
            <p className="text-sm text-emerald-700">{String(actionMessage)}</p>
          )}

          <Form method="post" className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="_action" value="variation-update" />

            <div className="grid gap-2">
              <Label htmlFor="kind">Kind</Label>
              <Input id="kind" name="kind" defaultValue={variation.kind} required />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" defaultValue={variation.code} required />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={variation.name} required />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
                Salvar alterações
              </Button>
            </div>
          </Form>

          <div className="border-t border-slate-200 pt-4">
            <Form
              method="post"
              onSubmit={(e) => {
                if (!confirm("Remover esta variação?")) e.preventDefault();
              }}
            >
              <input type="hidden" name="_action" value="variation-delete" />
              <Button type="submit" variant="destructive">
                Excluir variação
              </Button>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
