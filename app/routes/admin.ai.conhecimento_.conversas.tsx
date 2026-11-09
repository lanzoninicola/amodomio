import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import {
  ArrowLeft,
  Check,
  Database,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { scanCrmConversationKnowledge } from "~/domain/ai/conversation-knowledge.server";
import prisma from "~/lib/prisma/client.server";

const STATUSES = ["pending", "approved", "rejected"] as const;
type CandidateStatus = (typeof STATUSES)[number];

export const meta: MetaFunction = () => [
  { title: "Conversas CRM | Conhecimento AI" },
];

function statusFromRequest(request: Request): CandidateStatus {
  const value = new URL(request.url).searchParams.get("status");
  return STATUSES.includes(value as CandidateStatus)
    ? (value as CandidateStatus)
    : "pending";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const status = statusFromRequest(request);
  const [candidates, groupedCounts, sourceCount] = await Promise.all([
    prisma.aiConversationKnowledgeCandidate.findMany({
      where: { status },
      orderBy: [{ occurrenceCount: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.aiConversationKnowledgeCandidate.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.crmCustomerEvent.count({
      where: { event_type: "WHATSAPP_RECEIVED", source: "zapi-webhook" },
    }),
  ]);
  return json({ status, candidates, groupedCounts, sourceCount });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const actionName = String(form.get("_action") ?? "");

  if (actionName === "scan") {
    const result = await scanCrmConversationKnowledge();
    return json({ scan: result });
  }

  const id = String(form.get("id") ?? "").trim();
  if (!id) return json({ error: "Candidato inválido." }, { status: 400 });
  const candidate = await prisma.aiConversationKnowledgeCandidate.findUnique({
    where: { id },
  });
  if (!candidate)
    return json({ error: "Candidato não encontrado." }, { status: 404 });

  if (actionName === "approve") {
    const canonicalQuestion = String(
      form.get("canonicalQuestion") ?? ""
    ).trim();
    const answer = String(form.get("answer") ?? "").trim();
    if (!canonicalQuestion || !answer) {
      return json(
        {
          error:
            "Revise a pergunta e informe a resposta oficial antes de aprovar.",
        },
        { status: 400 }
      );
    }
    await prisma.aiConversationKnowledgeCandidate.update({
      where: { id },
      data: {
        canonicalQuestion,
        answer,
        status: "approved",
        reviewedAt: new Date(),
        publishedAt: new Date(),
      },
    });
    return redirect("/admin/ai/conhecimento/conversas?status=pending");
  }

  if (actionName === "reject") {
    await prisma.aiConversationKnowledgeCandidate.update({
      where: { id },
      data: { status: "rejected", reviewedAt: new Date(), publishedAt: null },
    });
    return redirect("/admin/ai/conhecimento/conversas?status=pending");
  }

  if (actionName === "reopen") {
    await prisma.aiConversationKnowledgeCandidate.update({
      where: { id },
      data: { status: "pending", reviewedAt: null, publishedAt: null },
    });
    return redirect("/admin/ai/conhecimento/conversas?status=pending");
  }

  return json({ error: "Ação inválida." }, { status: 400 });
}

const STATUS_LABELS: Record<CandidateStatus, string> = {
  pending: "Para revisar",
  approved: "Publicados",
  rejected: "Ignorados",
};

export default function ConversationKnowledgeReviewPage() {
  const { status, candidates, groupedCounts, sourceCount } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const counts = Object.fromEntries(
    groupedCounts.map((row) => [row.status, row._count._all])
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link to="/admin/ai/conhecimento">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Conhecimento da empresa
          </Link>
        </Button>
        <div>
          <Badge variant="secondary">AI / Conversas CRM</Badge>
          <h1 className="mt-2 text-2xl font-semibold">
            Conhecimento extraído das conversas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gere candidatos a partir das mensagens recebidas. Nenhum candidato
            entra no agente sem resposta revisada e aprovação explícita.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Database className="h-4 w-4" />
              {sourceCount.toLocaleString("pt-BR")} mensagens recebidas
              disponíveis
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A extração remove contatos dos exemplos, ignora saudações e exige
              ao menos duas ocorrências semelhantes.
            </p>
          </div>
          <Form method="post">
            <Button name="_action" value="scan" disabled={isSubmitting}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {isSubmitting ? "Analisando..." : "Gerar ou atualizar prévia"}
            </Button>
          </Form>
        </CardContent>
      </Card>

      {actionData && "scan" in actionData && actionData.scan ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Prévia concluída:{" "}
          {actionData.scan.messagesWithText.toLocaleString("pt-BR")} mensagens
          com texto, {actionData.scan.clusters} padrões,{" "}
          {actionData.scan.created} novos e {actionData.scan.refreshed}{" "}
          atualizados.
        </div>
      ) : null}
      {actionData && "error" in actionData && actionData.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionData.error}
        </div>
      ) : null}

      <div className="flex gap-5 border-b">
        {STATUSES.map((item) => (
          <Link
            key={item}
            to={`?status=${item}`}
            className={`border-b-2 px-1 pb-2 text-sm ${
              status === item
                ? "border-sky-500 font-semibold text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {STATUS_LABELS[item]} ({counts[item] ?? 0})
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            Nenhum candidato nesta situação.
          </p>
        ) : null}
        {candidates.map((candidate) => {
          const examples = Array.isArray(candidate.examples)
            ? candidate.examples.filter(
                (value): value is string => typeof value === "string"
              )
            : [];
          return (
            <Card key={candidate.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{candidate.category}</Badge>
                  <Badge variant="secondary">
                    {candidate.occurrenceCount} ocorrências
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    confiança {(candidate.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="id" value={candidate.id} />
                  <div className="space-y-2">
                    <Label htmlFor={`question-${candidate.id}`}>
                      Pergunta consolidada
                    </Label>
                    <Input
                      id={`question-${candidate.id}`}
                      name="canonicalQuestion"
                      defaultValue={candidate.canonicalQuestion}
                      disabled={status !== "pending"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`answer-${candidate.id}`}>
                      Resposta oficial
                    </Label>
                    <Textarea
                      id={`answer-${candidate.id}`}
                      name="answer"
                      defaultValue={candidate.answer ?? ""}
                      placeholder="Escreva a resposta que o agente poderá utilizar."
                      disabled={status !== "pending"}
                      rows={3}
                    />
                  </div>
                  <details className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-medium">
                      Ver exemplos anonimizados
                    </summary>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {examples.map((example, index) => (
                        <li key={`${candidate.id}-${index}`}>“{example}”</li>
                      ))}
                    </ul>
                  </details>
                  <div className="flex flex-wrap justify-end gap-2">
                    {status === "pending" ? (
                      <>
                        <Button
                          type="submit"
                          name="_action"
                          value="reject"
                          variant="outline"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Ignorar
                        </Button>
                        <Button type="submit" name="_action" value="approve">
                          <Check className="mr-2 h-4 w-4" />
                          Aprovar e publicar
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="submit"
                        name="_action"
                        value="reopen"
                        variant="outline"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reabrir revisão
                      </Button>
                    )}
                  </div>
                </Form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
