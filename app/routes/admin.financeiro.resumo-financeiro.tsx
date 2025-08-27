import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import { Await, Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import * as React from "react";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Trash2 } from "lucide-react";
import prismaClient from "~/lib/prisma/client.server";
import { DecimalInput } from "~/components/inputs/inputs";

// -------------------------------
// Types
// -------------------------------

type FinancialSummary = {
  id: string;
  isSnapshot: boolean;
  description: string | null;
  receitaBrutaAmount: number;
  impostoPerc: number
  impostoAmount: number
  vendaCartaoPerc: number
  taxaCartaoPerc: number
  taxaCartaoAmount: number
  receitaLiquidaAmount: number;
  custoFixoAmount: number;
  custoFixoPerc: number;
  custoVariavelAmount: number;
  custoVariavelPerc: number;
  pontoEquilibrioAmount: number;
  receitaBrutaDia01Perc: number;
  receitaBrutaDia02Perc: number;
  receitaBrutaDia03Perc: number;
  receitaBrutaDia04Perc: number;
  receitaBrutaDia05Perc: number;
  ticketMedio: number;
  createdAt: string;
  updatedAt: string;
};

// -------------------------------
// Loader com defer
// -------------------------------

export async function loader({ request }: LoaderFunctionArgs) {
  const currentPromise = await prismaClient.financialSummary.findFirst({
    where: { isSnapshot: false },
    orderBy: { createdAt: "desc" },
  });

  const snapshotsPromise = await prismaClient.financialSummary.findMany({
    where: { isSnapshot: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return defer({
    current: currentPromise,
    snapshots: snapshotsPromise,
  });
}

// -------------------------------
// Action
// -------------------------------

type ActionData = { ok: boolean; message: string };

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");
  const num = (k: string, def = 0) => {
    const v = form.get(k);
    if (v == null || v === "") return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  try {
    if (intent === "deleteSnapshot") {


      const id = String(form.get("snapshotId"));
      await prismaClient.financialSummary.delete({ where: { id } });
      return json({ ok: true, message: "Snapshot removido." });
    }

    const receitaBrutaAmount = num("receitaBrutaAmount");
    const receitaLiquidaAmount = num("receitaLiquidaAmount");
    const custoFixoAmount = num("custoFixoAmount");
    const custoVariavelAmount = num("custoVariavelAmount");
    const ticketMedio = num("ticketMedio");

    // Mantém a base como LÍQUIDA por padrão (pode-se adicionar seletor depois)
    const receitaBaseValor = receitaLiquidaAmount;
    const custoFixoPerc = receitaBaseValor > 0 ? custoFixoAmount / receitaBaseValor : 0;
    const custoVariavelPerc = receitaBaseValor > 0 ? custoVariavelAmount / receitaBaseValor : 0;
    const pontoEquilibrioAmount = 1 - custoVariavelPerc !== 0 ? custoFixoAmount / (1 - custoVariavelPerc) : 0;

    // Percentuais por dia chegam como "percentual" (ex.: 20 => 0.2)
    const receitaBrutaDia01Perc = num("receitaBrutaDia01Perc") / 100;
    const receitaBrutaDia02Perc = num("receitaBrutaDia02Perc") / 100;
    const receitaBrutaDia03Perc = num("receitaBrutaDia03Perc") / 100;
    const receitaBrutaDia04Perc = num("receitaBrutaDia04Perc") / 100;
    const receitaBrutaDia05Perc = num("receitaBrutaDia05Perc") / 100;

    const baseData = {
      receitaBrutaAmount,
      receitaLiquidaAmount,
      custoFixoAmount,
      custoFixoPerc,
      custoVariavelAmount,
      custoVariavelPerc,
      pontoEquilibrioAmount,
      receitaBrutaDia01Perc,
      receitaBrutaDia02Perc,
      receitaBrutaDia03Perc,
      receitaBrutaDia04Perc,
      receitaBrutaDia05Perc,
      ticketMedio,
    } as const;

    if (intent === "save") {
      const existing = await prismaClient.financialSummary.findFirst({
        where: { isSnapshot: false },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        await prismaClient.financialSummary.update({ where: { id: existing.id }, data: { ...baseData, isSnapshot: false } });
      } else {
        await prismaClient.financialSummary.create({ data: { ...baseData, isSnapshot: false, description: null } });
      }
      return json({ ok: true, message: "Resumo salvo." });
    }

    if (intent === "snapshot") {
      const description = String(form.get("description") || "Snapshot");
      await prismaClient.financialSummary.create({ data: { ...baseData, isSnapshot: true, description } });
      return json({ ok: true, message: "Snapshot criado." });
    }

    return json({ ok: false, message: "Intent desconhecido." });
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: "Erro ao processar a ação." });
  }
}

/* ----------------- Helpers de layout (2 colunas) ----------------- */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 md:items-center gap-2 md:gap-6">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}

// -------------------------------
// Client Page estilo DNA + DecimalInput
// -------------------------------

export default function AdminFinanceiroResumoFinanceiro() {
  const data = useLoaderData<typeof loader>();
  const action = useActionData<ActionData>();
  const nav = useNavigation();
  const saving = nav.state !== "idle";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Resumo Financeiro</h2>
      </div>
      <p className="text-sm text-muted-foreground">Edite os valores abaixo e salve para atualizar o resumo.</p>

      <Separator />

      <div className="rounded-md bg-muted p-4 text-sm space-y-2">
        <p>Depende do objetivo da meta:</p>

        <div className="flex flex-col">
          <p className="font-semibold uppercase">Receita Bruta</p>
          <p>Inclui tudo que você faturou nas vendas (sem tirar impostos, taxas, devoluções).</p>
          <p>Boa para comparar desempenho comercial e motivar equipe de vendas.</p>
          <p>Problema: pode mascarar a realidade, porque parte desse dinheiro não fica na pizzaria.</p>
        </div>

        <div className="flex flex-col">
          <p className="font-semibold uppercase">Receita Líquida</p>
          <p>Receita Bruta – impostos – descontos – devoluções</p>
          <p>Mostra o valor real que sobra para pagar custos e gerar lucro.</p>
          <p>É o que se conecta ao ponto de equilíbrio e ao DRE.</p>
        </div>

        <Separator className="my-2" />

        <p>Se a meta for financeira/gestão de negócio (cobrir custos, lucro, ponto de equilíbrio) → <strong>use RECEITA LÍQUIDA.</strong></p>
        <p>Se a meta for comercial (desempenho de vendas, incentivo de equipe) → <strong>pode usar RECEITA BRUTA</strong>, porque é o número que o time consegue enxergar mais facilmente.</p>
      </div>

      <Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save" />

        <React.Suspense fallback={<p>Carregando...</p>}>
          <Await resolve={data.current} errorElement={<div className="text-red-600">Erro ao carregar</div>}>
            {(current: Partial<FinancialSummary> | null) => {
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Row>
                      <Label>Receita Bruta (R$)</Label>
                      <DecimalInput name="receitaBrutaAmount" defaultValue={current?.receitaBrutaAmount ?? 0} fractionDigits={2} className="w-full" />
                    </Row>
                    {/* <Row>
                      <Label>Ticket Médio (R$)</Label>
                      <DecimalInput name="ticketMedio" defaultValue={current?.ticketMedio ?? 0} fractionDigits={2} className="w-full" />
                    </Row> */}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 gap-4">

                    <h3 className="font-semibold text-muted-foreground">Calculo Receita Liquida</h3>

                    <div className="grid grid-cols-2  gap-x-12">
                      <div className="flex flex-col gap-2">

                        <Row>
                          <Label>% Venda no cartão</Label>
                          <DecimalInput name="vendaCartaoPerc" defaultValue={(current?.vendaCartaoPerc ?? 0) * 100} fractionDigits={2} className="w-full" />
                        </Row>

                        <Row>
                          <Label>% Taxa Cartão</Label>
                          <DecimalInput name="taxaCartaoPerc" defaultValue={(current?.taxaCartaoPerc ?? 0) * 100} fractionDigits={2} className="w-full" />
                        </Row>
                        <Row>
                          <Label>Taxa Cartão (R$)</Label>
                          <DecimalInput name="taxaCartaAmount" defaultValue={current?.taxaCartaoAmount ?? 0} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Row>
                          <Label>% Imposto</Label>
                          <DecimalInput name="impostoPerc" defaultValue={(current?.impostoPerc ?? 0) * 100} fractionDigits={2} className="w-full" />
                        </Row>

                        <Row>
                          <Label>Imposto (R$)</Label>
                          <DecimalInput name="impostoAmount" defaultValue={(current?.impostoAmount ?? 0) * 100} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>
                      </div>


                    </div>

                    <Row>
                      <Label>Receita Líquida (R$)</Label>
                      <DecimalInput name="receitaLiquidaAmount" defaultValue={current?.receitaLiquidaAmount ?? 0} fractionDigits={2} className="w-full" />
                    </Row>

                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Row>
                        <Label>Custo Fixo (R$)</Label>
                        <DecimalInput name="custoFixoAmount" defaultValue={current?.custoFixoAmount ?? 0} fractionDigits={2} className="w-full" />
                      </Row>
                      <Row>
                        <Label>Custo Fixo (%)</Label>
                        <DecimalInput name="custoFixoAmount" defaultValue={current?.custoFixoPerc ?? 0} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled={true} />
                      </Row>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Row>
                        <Label>Custo Variável (R$)</Label>
                        <DecimalInput name="custoVariavelAmount" defaultValue={current?.custoVariavelAmount ?? 0} fractionDigits={2} className="w-full" />
                      </Row>
                      <Row>
                        <Label>Custo Variável (%)</Label>
                        <DecimalInput name="custoFixoAmount" defaultValue={current?.custoVariavelPerc ?? 0} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled={true} />
                      </Row>
                    </div>

                  </div>

                  <Separator />

                  <Row>
                    <Label>Ponto de equilibrio</Label>
                    <DecimalInput name="pontoEquilibrioAmount" defaultValue={current?.pontoEquilibrioAmount ?? 0} fractionDigits={2} className="w-full" />
                  </Row>

                  <Separator />

                  <Row>
                    <Label>% Participação Receita - Quarta</Label>
                    <DecimalInput name="receitaBrutaDia01Perc" defaultValue={(current?.receitaBrutaDia01Perc ?? 0) * 100} fractionDigits={2} className="w-full" />
                  </Row>
                  <Row>
                    <Label>% Participação Receita - Quinta</Label>
                    <DecimalInput name="receitaBrutaDia02Perc" defaultValue={(current?.receitaBrutaDia02Perc ?? 0) * 100} fractionDigits={2} className="w-full" />
                  </Row>
                  <Row>
                    <Label>% Participação Receita - Sexta</Label>
                    <DecimalInput name="receitaBrutaDia03Perc" defaultValue={(current?.receitaBrutaDia03Perc ?? 0) * 100} fractionDigits={2} className="w-full" />
                  </Row>
                  <Row>
                    <Label>% Participação Receita - Sábado</Label>
                    <DecimalInput name="receitaBrutaDia04Perc" defaultValue={(current?.receitaBrutaDia04Perc ?? 0) * 100} fractionDigits={2} className="w-full" />
                  </Row>
                  <Row>
                    <Label>% Participação Receita - Domingo</Label>
                    <DecimalInput name="receitaBrutaDia05Perc" defaultValue={(current?.receitaBrutaDia05Perc ?? 0) * 100} fractionDigits={2} className="w-full" />
                  </Row>



                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar"}
                    </Button>

                  </div>

                  {action && (
                    <Alert variant={action.ok ? "default" : "destructive"}>
                      <AlertTitle>{action.ok ? "Sucesso" : "Erro"}</AlertTitle>
                      <AlertDescription>{action.message}</AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            }}
          </Await>
        </React.Suspense>
      </Form>

      <Separator />

      <h4 className="font-semibold uppercase">Snapshots</h4>
      <Form method="post" className="grid grid-cols-8 gap-x-4">
        <input type="hidden" name="intent" value="snapshot" />
        <Textarea name="description" placeholder="Descrição do snapshot" className="col-span-4" />
        <Button type="submit" variant="secondary" className="col-span-2">Criar snapshot</Button>
      </Form>

      <section className="space-y-3">
        <h4 className="font-semibold">Snapshots recentes</h4>
        <React.Suspense fallback={<p>Carregando snapshots...</p>}>
          <Await resolve={data.snapshots} errorElement={<div className="text-red-600">Erro ao carregar snapshots</div>}>
            {(snapshots: Partial<FinancialSummary>[]) => (
              snapshots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum snapshot ainda.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {snapshots.map((s) => (
                    <li key={s.id} >
                      <div className="grid grid-cols-1 md:grid-cols-8 gap-2 p-3 text-sm">
                        <span className="md:col-span-3 font-medium">{s.description ?? "-"}</span>
                        <span className="opacity-80">Receita Bruta: {s.receitaBrutaAmount}</span>
                        <span className="opacity-80">C.Fixo: {s.custoFixoAmount}</span>
                        <span className="opacity-80">PE: {s.pontoEquilibrioAmount}</span>
                        <span className="">{new Date(s.createdAt!).toLocaleString()}</span>
                        <Form method="post" >
                          <input type="hidden" name="intent" value="deleteSnapshot" />
                          <input type="hidden" name="snapshotId" value={s.id} />
                          <Button type="submit" variant="secondary" className="col-span-2">
                            <Trash2 className="h-4 w-4 mr-2" /> Remover
                          </Button>
                        </Form>
                      </div>

                    </li>
                  ))}
                </ul>
              )
            )}
          </Await>
        </React.Suspense>
      </section>
    </div>
  );
}
