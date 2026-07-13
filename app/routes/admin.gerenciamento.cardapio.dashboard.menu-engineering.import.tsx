import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import formatMoneyString from "~/utils/format-money-string";
import formatDecimalPlaces from "~/utils/format-decimal-places";

export const meta: MetaFunction = () => [
  { title: "Importar vendas | Menu Engineering" },
  { name: "robots", content: "noindex" },
];

type ImportPreviewItem = {
  id: string;
  topping: string;
  quantity: number;
  value: number;
};

type ImportRow = {
  id: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  source: string | null;
  updatedAt: string;
  totalItemsSold: number;
  totalRevenue: number;
  totalPizzas: number;
  pizzaRevenue: number;
  itemsCount: number;
  preview: ImportPreviewItem[];
};

type LoaderData = {
  imports: ImportRow[];
};

type ActionData = {
  status: number;
  message?: string;
  payload?: any;
};

type ParsedMenuEngineeringImport = {
  month: number;
  year: number;
  periodStart: Date;
  periodEnd: Date;
  source: string | null;
  totalItemsSold: number;
  totalRevenue: number;
  totalPizzas: number;
  pizzaRevenue: number;
  items: {
    topping: string;
    quantity: number;
    value: number;
  }[];
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const normalized = trimmed.includes(",")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed;
    return Number(normalized);
  }
  return NaN;
};

const parseDateBR = (value: unknown) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const makeMonthPeriod = (month: number, year: number) => {
  const periodStart = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  return { periodStart, periodEnd };
};

const isValidPeriod = (periodStart: Date, periodEnd: Date) =>
  periodStart.getTime() <= periodEnd.getTime();

const parseExtensionPayload = (
  payload: any
): ParsedMenuEngineeringImport | null => {
  const periodStart = parseDateBR(payload?.periodo?.inicio);
  const periodEnd = parseDateBR(payload?.periodo?.fim);
  const sabores = Array.isArray(payload?.sabores) ? payload.sabores : null;

  if (!periodStart || !periodEnd || !sabores) return null;
  if (!isValidPeriod(periodStart, periodEnd)) {
    throw new Error(
      "Periodo invalido: a data inicial precisa ser anterior ou igual a data final."
    );
  }

  const items = sabores
    .map((row: any) => ({
      topping: String(row?.nome ?? "").trim(),
      quantity: parseNumber(row?.qtd_total),
      value: parseNumber(row?.valor_total),
    }))
    .filter(
      (row: any) =>
        row.topping &&
        Number.isFinite(row.quantity) &&
        Number.isFinite(row.value)
    );

  return {
    month: periodStart.getUTCMonth() + 1,
    year: periodStart.getUTCFullYear(),
    periodStart,
    periodEnd,
    source:
      typeof payload?.source === "string" ? payload.source : "Extensao Saipos",
    totalItemsSold: parseNumber(payload?.resumo?.total_itens_vendidos) || 0,
    totalRevenue: parseNumber(payload?.resumo?.faturamento_total) || 0,
    totalPizzas: parseNumber(payload?.resumo?.total_pizzas) || 0,
    pizzaRevenue: parseNumber(payload?.resumo?.faturamento_pizzas) || 0,
    items,
  };
};

const parseLegacyPayload = (
  payload: any
): ParsedMenuEngineeringImport | null => {
  const month = parseNumber(payload?.month);
  const year = parseNumber(payload?.year);
  const toppings = Array.isArray(payload?.toppings) ? payload.toppings : null;

  if (!Number.isFinite(month) || !Number.isFinite(year) || !toppings)
    return null;
  if (month < 1 || month > 12) throw new Error("Campo month invalido (1-12).");
  if (year < 2000 || year > 2100)
    throw new Error("Campo year invalido (ex: 2025).");

  const items = toppings
    .map((row: any) => ({
      topping: String(row?.topping ?? "").trim(),
      quantity: parseNumber(row?.quantity),
      value: parseNumber(row?.value),
    }))
    .filter(
      (row: any) =>
        row.topping &&
        Number.isFinite(row.quantity) &&
        Number.isFinite(row.value)
    );

  const safeMonth = Math.trunc(month);
  const safeYear = Math.trunc(year);
  const { periodStart, periodEnd } = makeMonthPeriod(safeMonth, safeYear);

  return {
    month: safeMonth,
    year: safeYear,
    periodStart,
    periodEnd,
    source: typeof payload?.source === "string" ? payload.source : null,
    totalItemsSold: items.reduce((sum, item) => sum + item.quantity, 0),
    totalRevenue: items.reduce((sum, item) => sum + item.value, 0),
    totalPizzas: items.reduce((sum, item) => sum + item.quantity, 0),
    pizzaRevenue: items.reduce((sum, item) => sum + item.value, 0),
    items,
  };
};

const parseImportPayload = (payload: any) => {
  const parsed = parseExtensionPayload(payload) ?? parseLegacyPayload(payload);
  if (!parsed) {
    throw new Error(
      "JSON invalido. Envie o formato da extensao Saipos com periodo/resumo/sabores."
    );
  }
  if (parsed.items.length === 0) {
    throw new Error("Nenhum sabor valido encontrado no arquivo.");
  }
  return parsed;
};

const formatPeriod = (periodStart: string | Date, periodEnd: string | Date) => {
  const formatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
  return `${formatter.format(new Date(periodStart))} ate ${formatter.format(
    new Date(periodEnd)
  )}`;
};

export async function loader({}: LoaderFunctionArgs) {
  const imports = await prismaClient.menuEngineeringImport.findMany({
    select: {
      id: true,
      month: true,
      year: true,
      periodStart: true,
      periodEnd: true,
      source: true,
      totalItemsSold: true,
      totalRevenue: true,
      totalPizzas: true,
      pizzaRevenue: true,
      updatedAt: true,
      _count: { select: { items: true } },
      items: {
        select: {
          id: true,
          topping: true,
          quantity: true,
          value: true,
        },
        orderBy: { quantity: "desc" },
        take: 6,
      },
    },
    orderBy: [{ periodStart: "desc" }, { periodEnd: "desc" }],
  });

  return json<LoaderData>({
    imports: imports.map((item) => ({
      id: item.id,
      month: item.month,
      year: item.year,
      periodStart: item.periodStart.toISOString(),
      periodEnd: item.periodEnd.toISOString(),
      source: item.source,
      totalItemsSold: item.totalItemsSold,
      totalRevenue: item.totalRevenue,
      totalPizzas: item.totalPizzas,
      pizzaRevenue: item.pizzaRevenue,
      updatedAt: item.updatedAt.toISOString(),
      itemsCount: item._count.items,
      preview: item.items,
    })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const action = String(formData.get("_action") ?? "");

    if (action === "delete") {
      const importId = String(formData.get("importId") ?? "");
      if (!importId)
        return badRequest({ message: "Importacao nao encontrada." });

      await prismaClient.menuEngineeringImport.delete({
        where: { id: importId },
      });
      return ok({ message: "Importacao removida." });
    }

    const file = formData.get("file");
    const jsonText = String(formData.get("json") ?? "").trim();

    let raw = jsonText;
    if (file && typeof file === "object" && "text" in file) {
      const fileText = await (file as File).text();
      if (fileText.trim()) raw = fileText.trim();
    }

    if (!raw) {
      return badRequest({
        message: "Envie um JSON valido (arquivo ou texto).",
      });
    }

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return badRequest({ message: "JSON invalido. Verifique a formatacao." });
    }

    let parsed: ParsedMenuEngineeringImport;
    try {
      parsed = parseImportPayload(payload);
    } catch (error) {
      return badRequest({
        message: error instanceof Error ? error.message : "Arquivo invalido.",
      });
    }

    await prismaClient.$transaction(async (tx) => {
      const existing = await tx.menuEngineeringImport.findFirst({
        where: {
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
        },
        select: { id: true },
      });

      let importId = existing?.id ?? null;

      if (importId) {
        await tx.menuEngineeringImport.update({
          where: { id: importId },
          data: {
            month: parsed.month,
            year: parsed.year,
            source: parsed.source,
            totalItemsSold: parsed.totalItemsSold,
            totalRevenue: parsed.totalRevenue,
            totalPizzas: parsed.totalPizzas,
            pizzaRevenue: parsed.pizzaRevenue,
          },
        });
        await tx.menuEngineeringImportItem.deleteMany({ where: { importId } });
      } else {
        const created = await tx.menuEngineeringImport.create({
          data: {
            month: parsed.month,
            year: parsed.year,
            periodStart: parsed.periodStart,
            periodEnd: parsed.periodEnd,
            source: parsed.source,
            totalItemsSold: parsed.totalItemsSold,
            totalRevenue: parsed.totalRevenue,
            totalPizzas: parsed.totalPizzas,
            pizzaRevenue: parsed.pizzaRevenue,
          },
          select: { id: true },
        });
        importId = created.id;
      }

      await tx.menuEngineeringImportItem.createMany({
        data: parsed.items.map((row) => ({
          importId: importId as string,
          topping: row.topping,
          quantity: row.quantity,
          value: row.value,
        })),
      });
    });

    return ok({
      message: "Importacao concluida. Dados sobrescritos para o mesmo periodo.",
    });
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
          <h1 className="text-2xl font-semibold">
            Importar dados da extensao Saipos
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie o JSON mensal gerado pela extensao. Se existir importacao com
            o mesmo periodo, ela sera sobrescrita.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/gerenciamento/cardapio/dashboard/menu-engineering">
            Voltar a matriz
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload JSON</CardTitle>
          <CardDescription>
            O arquivo deve conter periodo, resumo e sabores consolidados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            method="post"
            encType="multipart/form-data"
            className="grid gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="file">Arquivo JSON</Label>
              <Input
                id="file"
                type="file"
                name="file"
                accept="application/json,.txt"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="json">Ou cole o JSON abaixo</Label>
              <Textarea
                id="json"
                name="json"
                rows={10}
                placeholder='{"periodo":{"inicio":"01/10/2025","fim":"31/10/2025"},"resumo":{"total_itens_vendidos":570,"faturamento_total":68291.48,"total_pizzas":567,"faturamento_pizzas":67995.43},"sabores":[{"nome":"CALABRESA","qtd_total":44.4,"valor_total":2961.47}]}'
              />
            </div>

            {actionData?.message ? (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                {actionData.message}
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Importando..." : "Importar periodo"}
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historico de importacoes</CardTitle>
          <CardDescription>
            Periodos armazenados para comparacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {data.imports.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhuma importacao registrada.
            </p>
          ) : (
            data.imports.map((imp) => (
              <div
                key={imp.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {formatPeriod(imp.periodStart, imp.periodEnd)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Atualizado em{" "}
                    {new Date(imp.updatedAt).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDecimalPlaces(imp.totalPizzas, 2)} pizzas · R${" "}
                    {formatMoneyString(imp.pizzaRevenue)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {imp.source ? (
                    <Badge variant="outline">{imp.source}</Badge>
                  ) : null}
                  <Badge variant="secondary">{imp.itemsCount} sabores</Badge>
                  <Form method="post">
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="importId" value={imp.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        if (
                          !window.confirm(
                            "Tem certeza que deseja excluir este periodo?"
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      Excluir
                    </Button>
                  </Form>
                </div>
                <details className="w-full text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    Ver sabores importados
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {imp.preview.length === 0 ? (
                      <span>Nenhum item encontrado.</span>
                    ) : (
                      imp.preview.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-md border border-border px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">
                              {row.topping}
                            </span>
                            <span>{formatDecimalPlaces(row.quantity, 2)}</span>
                          </div>
                          <div>Valor: R$ {formatMoneyString(row.value)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
