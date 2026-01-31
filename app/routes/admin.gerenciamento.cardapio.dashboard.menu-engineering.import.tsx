import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";

export const meta: MetaFunction = () => [
  { title: "Importar vendas | Menu Engineering" },
  { name: "robots", content: "noindex" },
];

type ImportRow = { id: string; month: number; year: number; source: string | null; updatedAt: string; itemsCount: number };

type LoaderData = {
  imports: ImportRow[];
};

type ActionData = {
  status: number;
  message?: string;
  payload?: any;
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value.replace(",", "."));
  return NaN;
};

export async function loader({}: LoaderFunctionArgs) {
  const imports = await prismaClient.menuEngineeringImport.findMany({
    select: {
      id: true,
      month: true,
      year: true,
      source: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return json<LoaderData>({
    imports: imports.map((item) => ({
      id: item.id,
      month: item.month,
      year: item.year,
      source: item.source,
      updatedAt: item.updatedAt.toISOString(),
      itemsCount: item._count.items,
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const jsonText = String(formData.get("json") ?? "").trim();

    let raw = jsonText;
    if (file && typeof file === "object" && "text" in file) {
      const fileText = await (file as File).text();
      if (fileText.trim()) raw = fileText.trim();
    }

    if (!raw) {
      return badRequest({ message: "Envie um JSON válido (arquivo ou texto)." });
    }

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return badRequest({ message: "JSON inválido. Verifique a formatação." });
    }

    const month = parseNumber(payload?.month);
    const year = parseNumber(payload?.year);
    const source = typeof payload?.source === "string" ? payload.source : null;
    const toppings = Array.isArray(payload?.toppings) ? payload.toppings : null;

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return badRequest({ message: "Campo month inválido (1-12)." });
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return badRequest({ message: "Campo year inválido (ex: 2025)." });
    }
    if (!toppings) {
      return badRequest({ message: "Campo toppings deve ser uma lista." });
    }

    const sanitized = toppings
      .map((row: any) => ({
        topping: String(row?.topping ?? "").trim(),
        quantity: parseNumber(row?.quantity),
        value: parseNumber(row?.value),
      }))
      .filter((row: any) => row.topping && Number.isFinite(row.quantity) && Number.isFinite(row.value));

    if (sanitized.length === 0) {
      return badRequest({ message: "Nenhum item válido encontrado em toppings." });
    }

    await prismaClient.$transaction(async (tx) => {
      const existing = await tx.menuEngineeringImport.findFirst({
        where: { month: Math.trunc(month), year: Math.trunc(year) },
        select: { id: true },
      });

      let importId = existing?.id ?? null;

      if (importId) {
        await tx.menuEngineeringImport.update({
          where: { id: importId },
          data: { source },
        });
        await tx.menuEngineeringImportItem.deleteMany({ where: { importId } });
      } else {
        const created = await tx.menuEngineeringImport.create({
          data: { month: Math.trunc(month), year: Math.trunc(year), source },
          select: { id: true },
        });
        importId = created.id;
      }

      await tx.menuEngineeringImportItem.createMany({
        data: sanitized.map((row: any) => ({
          importId: importId as string,
          topping: row.topping,
          quantity: Math.trunc(row.quantity),
          value: Number(row.value),
        })),
      });
    });

    return ok({ message: "Importação concluída. Dados sobrescritos para o mês/ano." });
  } catch (error) {
    return serverError(error);
  }
}

export default function MenuEngineeringImportPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Importar vendas por sabor</h1>
          <p className="text-sm text-muted-foreground">
            Faça upload de um JSON mensal. Se existir importação do mesmo mês/ano, ela será sobrescrita.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/gerenciamento/cardapio/dashboard/menu-engineering">Voltar à matriz</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload JSON</CardTitle>
          <CardDescription>Envie um arquivo .json ou cole o conteúdo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" encType="multipart/form-data" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="file">Arquivo JSON</Label>
              <Input id="file" type="file" name="file" accept="application/json" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="json">Ou cole o JSON abaixo</Label>
              <Textarea
                id="json"
                name="json"
                rows={10}
                placeholder='{"month":"07","year":"2025","toppings":[{"topping":"Margherita","quantity":120,"value":4200}]}'
              />
            </div>

            {actionData?.message ? (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                {actionData.message}
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Importando..." : "Importar"}
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de importações</CardTitle>
          <CardDescription>Últimos arquivos enviados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {data.imports.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma importação registrada.</p>
          ) : (
            data.imports.map((imp) => (
              <div
                key={imp.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {String(imp.month).padStart(2, "0")}/{imp.year}
                  </span>
                  <span className="text-xs text-muted-foreground">Atualizado em {new Date(imp.updatedAt).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2">
                  {imp.source ? <Badge variant="outline">{imp.source}</Badge> : null}
                  <Badge variant="secondary">{imp.itemsCount} itens</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
