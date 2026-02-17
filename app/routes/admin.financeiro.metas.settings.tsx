import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "~/components/inputs/inputs";

import prismaClient from "~/lib/prisma/client.server";
import formatMoneyString from "~/utils/format-money-string";

export async function loader({}: LoaderFunctionArgs) {
  const settings = await prismaClient.financialDailyGoalSettings.findFirst({
    orderBy: { id: "desc" },
    select: {
      id: true,
      targetProfitPerc: true,
      salesDistributionPctDay01: true,
      salesDistributionPctDay02: true,
      salesDistributionPctDay03: true,
      salesDistributionPctDay04: true,
      salesDistributionPctDay05: true,
    },
  });

  return json({ settings });
}

function asPct(value: number) {
  return `${formatMoneyString(value ?? 0, 2)}%`;
}

type ActionData = {
  ok: boolean;
  message: string;
};

function parseNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor inválido em ${label}.`);
  }
  if (parsed < 0) {
    throw new Error(`O campo ${label} não pode ser negativo.`);
  }
  return parsed;
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent !== "saveSettings") {
    return json<ActionData>({ ok: false, message: "Intent inválido." }, { status: 400 });
  }

  try {
    const payload = {
      targetProfitPerc: parseNumber(form.get("targetProfitPerc"), "% lucro desejado"),
      salesDistributionPctDay01: parseNumber(form.get("salesDistributionPctDay01"), "Dia 1 (Quarta)"),
      salesDistributionPctDay02: parseNumber(form.get("salesDistributionPctDay02"), "Dia 2 (Quinta)"),
      salesDistributionPctDay03: parseNumber(form.get("salesDistributionPctDay03"), "Dia 3 (Sexta)"),
      salesDistributionPctDay04: parseNumber(form.get("salesDistributionPctDay04"), "Dia 4 (Sábado)"),
      salesDistributionPctDay05: parseNumber(form.get("salesDistributionPctDay05"), "Dia 5 (Domingo)"),
    };

    const current = await prismaClient.financialDailyGoalSettings.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (current) {
      await prismaClient.financialDailyGoalSettings.update({
        where: { id: current.id },
        data: payload,
      });
    } else {
      await prismaClient.financialDailyGoalSettings.create({
        data: payload,
      });
    }

    return json<ActionData>({ ok: true, message: "Configurações salvas com sucesso." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar configurações.";
    return json<ActionData>({ ok: false, message }, { status: 400 });
  }
}

export default function AdminFinanceiroMetasSettingsRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const current = data.settings ?? null;
  const totalDistribution = current
    ? Number(current.salesDistributionPctDay01) +
      Number(current.salesDistributionPctDay02) +
      Number(current.salesDistributionPctDay03) +
      Number(current.salesDistributionPctDay04) +
      Number(current.salesDistributionPctDay05)
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configurações de metas</CardTitle>
          <CardDescription>
            Configuração única de distribuição e lucro. Sempre salva por update dos valores atuais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="saveSettings" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">% lucro desejado</p>
                <DecimalInput
                  name="targetProfitPerc"
                  defaultValue={Number(current?.targetProfitPerc ?? 0)}
                  fractionDigits={2}
                  className="w-32 text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Anterior: {asPct(Number(current?.targetProfitPerc ?? 0))}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Somatório da distribuição atual</p>
                <p className="font-mono text-2xl">{asPct(totalDistribution)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Dia 1 (Quarta)</p>
                <DecimalInput
                  name="salesDistributionPctDay01"
                  defaultValue={Number(current?.salesDistributionPctDay01 ?? 0)}
                  fractionDigits={2}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">
                  Anterior: {asPct(Number(current?.salesDistributionPctDay01 ?? 0))}
                </p>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Dia 2 (Quinta)</p>
                <DecimalInput
                  name="salesDistributionPctDay02"
                  defaultValue={Number(current?.salesDistributionPctDay02 ?? 0)}
                  fractionDigits={2}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">
                  Anterior: {asPct(Number(current?.salesDistributionPctDay02 ?? 0))}
                </p>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Dia 3 (Sexta)</p>
                <DecimalInput
                  name="salesDistributionPctDay03"
                  defaultValue={Number(current?.salesDistributionPctDay03 ?? 0)}
                  fractionDigits={2}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">
                  Anterior: {asPct(Number(current?.salesDistributionPctDay03 ?? 0))}
                </p>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Dia 4 (Sábado)</p>
                <DecimalInput
                  name="salesDistributionPctDay04"
                  defaultValue={Number(current?.salesDistributionPctDay04 ?? 0)}
                  fractionDigits={2}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">
                  Anterior: {asPct(Number(current?.salesDistributionPctDay04 ?? 0))}
                </p>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Dia 5 (Domingo)</p>
                <DecimalInput
                  name="salesDistributionPctDay05"
                  defaultValue={Number(current?.salesDistributionPctDay05 ?? 0)}
                  fractionDigits={2}
                  className="w-28"
                />
                <p className="text-xs text-muted-foreground">
                  Anterior: {asPct(Number(current?.salesDistributionPctDay05 ?? 0))}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar configurações"}</Button>
            </div>
          </Form>

          {actionData ? (
            <div
              className={`rounded-md border p-3 text-sm ${
                actionData.ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              {actionData.message}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
