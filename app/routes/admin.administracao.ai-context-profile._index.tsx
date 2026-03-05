import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import prismaClient from "~/lib/prisma/client.server";

const LANGUAGES = ["pt-BR", "en-US"] as const;
type Language = (typeof LANGUAGES)[number];

const DEFAULT_CONTENT: Record<Language, string> = {
  "pt-BR": `# AI Context Profile\n\n## Visão Geral\nEste perfil define a identidade, tom e regras operacionais do assistente de IA para uso profissional.\n\n## Objetivo\n- Entregar respostas claras, acionáveis e seguras.\n- Priorizar precisão, contexto de negócio e consistência.\n\n## Tom de Voz\n- Profissional, direto e respeitoso.\n- Linguagem simples e sem jargão desnecessário.\n\n## Regras Operacionais\n1. Confirmar contexto antes de responder temas críticos.\n2. Sinalizar incertezas com transparência.\n3. Evitar suposições quando faltarem dados.\n4. Sempre propor próximos passos práticos.\n\n## Restrições\n- Não inventar fatos.\n- Não expor dados sensíveis.\n- Não prometer ações fora do escopo.\n`,
  "en-US": `# AI Context Profile\n\n## Overview\nThis profile defines the AI assistant identity, tone, and operating rules for professional use.\n\n## Objective\n- Deliver clear, actionable, and safe responses.\n- Prioritize accuracy, business context, and consistency.\n\n## Voice and Tone\n- Professional, direct, and respectful.\n- Simple language with no unnecessary jargon.\n\n## Operating Rules\n1. Confirm context before answering critical topics.\n2. Be transparent when uncertainty exists.\n3. Avoid assumptions when data is missing.\n4. Always suggest practical next steps.\n\n## Constraints\n- Do not fabricate facts.\n- Do not expose sensitive data.\n- Do not promise actions outside scope.\n`,
};

type ProfileVersion = {
  id: string;
  language: Language;
  version: number;
  content: string;
  isActive: boolean;
  createdAt: Date;
};

type LoaderData = {
  selectedLanguage: Language;
  versionsByLanguage: Record<Language, ProfileVersion[]>;
  activeByLanguage: Record<Language, ProfileVersion | null>;
};

type ActionData = {
  error?: string;
  submitted?: {
    language: Language;
    content: string;
  };
};

export const meta: MetaFunction = () => ([{ title: "AI Context Profile" }]);

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGES.includes(value as Language);
}

function getLanguageFromUrl(request: Request): Language {
  const url = new URL(request.url);
  const maybeLanguage = url.searchParams.get("lang");
  return isLanguage(maybeLanguage) ? maybeLanguage : "pt-BR";
}

async function createVersion(params: { language: Language; content: string }) {
  return prismaClient.$transaction(async (tx) => {
    const [latest] = await tx.$queryRaw<Array<{ version: number }>>`
      SELECT version
      FROM ai_context_profile_versions
      WHERE language = ${params.language}
      ORDER BY version DESC
      LIMIT 1
    `;

    const nextVersion = (latest?.version ?? 0) + 1;

    await tx.$executeRaw`
      UPDATE ai_context_profile_versions
      SET is_active = false, updated_at = NOW()
      WHERE language = ${params.language}
        AND is_active = true
    `;

    return tx.$executeRaw`
      INSERT INTO ai_context_profile_versions (id, language, version, content, is_active, created_at, updated_at)
      VALUES (${randomUUID()}, ${params.language}, ${nextVersion}, ${params.content}, true, NOW(), NOW())
    `;
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const selectedLanguage = getLanguageFromUrl(request);

  const records = await prismaClient.$queryRaw<
    Array<{
      id: string;
      language: string;
      version: number;
      content: string;
      is_active: boolean;
      created_at: Date;
    }>
  >(Prisma.sql`
    SELECT id, language, version, content, is_active, created_at
    FROM ai_context_profile_versions
    WHERE language IN (${Prisma.join(LANGUAGES)})
    ORDER BY language ASC, version DESC
  `).catch(() => []);

  const versionsByLanguage: Record<Language, ProfileVersion[]> = {
    "pt-BR": [],
    "en-US": [],
  };

  for (const record of records) {
    if (!isLanguage(record.language)) continue;

    versionsByLanguage[record.language].push({
      id: record.id,
      language: record.language,
      version: record.version,
      content: record.content,
      isActive: record.is_active,
      createdAt: new Date(record.created_at),
    });
  }

  const activeByLanguage: Record<Language, ProfileVersion | null> = {
    "pt-BR": versionsByLanguage["pt-BR"].find((version) => version.isActive) ?? versionsByLanguage["pt-BR"][0] ?? null,
    "en-US": versionsByLanguage["en-US"].find((version) => version.isActive) ?? versionsByLanguage["en-US"][0] ?? null,
  };

  return json<LoaderData>({
    selectedLanguage,
    versionsByLanguage,
    activeByLanguage,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionName = String(formData.get("_action") || "");
  const languageValue = formData.get("language");

  if (!isLanguage(languageValue)) {
    return json<ActionData>({ error: "Idioma inválido." }, { status: 400 });
  }

  const language = languageValue;
  const content = String(formData.get("content") || "");

  if ((actionName === "save" || actionName === "update-current") && !content.trim()) {
    return json<ActionData>(
      {
        error: "O conteúdo não pode ficar vazio.",
        submitted: { language, content },
      },
      { status: 400 }
    );
  }

  if (actionName === "save") {
    await createVersion({ language, content });

    return redirect(`/admin/administracao/ai-context-profile?lang=${encodeURIComponent(language)}`);
  }

  if (actionName === "update-current") {
    const updatedRows = await prismaClient.$executeRaw`
      UPDATE ai_context_profile_versions
      SET content = ${content}, updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM ai_context_profile_versions
        WHERE language = ${language}
        ORDER BY is_active DESC, version DESC
        LIMIT 1
      )
    `;

    if (!updatedRows) {
      await createVersion({ language, content });
    }

    return redirect(`/admin/administracao/ai-context-profile?lang=${encodeURIComponent(language)}`);
  }

  if (actionName === "rollback") {
    const versionId = String(formData.get("versionId") || "");
    if (!versionId) {
      return json<ActionData>({ error: "Versão inválida." }, { status: 400 });
    }

    const [sourceVersion] = await prismaClient.$queryRaw<
      Array<{ id: string; language: string; content: string }>
    >`
      SELECT id, language, content
      FROM ai_context_profile_versions
      WHERE id = ${versionId}
      LIMIT 1
    `;

    if (!sourceVersion || sourceVersion.language !== language) {
      return json<ActionData>({ error: "Versão não encontrada para este idioma." }, { status: 404 });
    }

    await createVersion({ language, content: sourceVersion.content });

    return redirect(`/admin/administracao/ai-context-profile?lang=${encodeURIComponent(language)}`);
  }

  return json<ActionData>({ error: "Ação inválida." }, { status: 400 });
}

export default function AdminAiContextProfilePage() {
  const { selectedLanguage, versionsByLanguage, activeByLanguage } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const activeVersion = activeByLanguage[selectedLanguage];

  const initialContent = useMemo(() => {
    if (actionData?.submitted?.language === selectedLanguage) {
      return actionData.submitted.content;
    }

    return activeVersion?.content ?? DEFAULT_CONTENT[selectedLanguage];
  }, [actionData?.submitted?.content, actionData?.submitted?.language, activeVersion?.content, selectedLanguage]);

  const [editorValue, setEditorValue] = useState(initialContent);

  useEffect(() => {
    setEditorValue(initialContent);
  }, [initialContent]);

  const versions = versionsByLanguage[selectedLanguage] || [];
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary" className="w-fit">Administração</Badge>
        <h1 className="text-2xl font-semibold">AI Context Profile</h1>
        <p className="text-sm text-muted-foreground">
          Edite o contexto profissional em Markdown, com histórico versionado por idioma (pt-BR e en-US).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Idioma</CardTitle>
          <div className="flex items-center gap-2">
            {LANGUAGES.map((language) => {
              const isSelected = selectedLanguage === language;

              return (
                <Link
                  key={language}
                  to={`?lang=${encodeURIComponent(language)}`}
                  className={isSelected
                    ? "inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  }
                >
                  {language}
                </Link>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {actionData?.error ? (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionData.error}
            </p>
          ) : null}

          <Form method="post" className="space-y-4">
            <input type="hidden" name="language" value={selectedLanguage} />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-content">Perfil em Markdown</Label>
                <Textarea
                  id="profile-content"
                  name="content"
                  className="min-h-[420px] font-mono text-sm"
                  value={editorValue}
                  onChange={(event) => setEditorValue(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Output</Label>
                <pre className="h-[550px] overflow-auto rounded-md border bg-muted/40 p-4 text-sm leading-relaxed">
                  <code>{editorValue}</code>
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Versão ativa: {activeVersion ? `v${activeVersion.version}` : "nenhuma"}
              </p>

              <div className="flex items-center gap-2">
                <Button type="submit" name="_action" value="update-current" variant="outline" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Atualizar versão atual"}
                </Button>
                <Button type="submit" name="_action" value="save" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar nova versão"}
                </Button>
              </div>
            </div>
          </Form>

          <Separator />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Histórico de versões ({selectedLanguage})</h2>

            {!versions.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma versão salva para este idioma.</p>
            ) : (
              <div className="overflow-auto rounded-md border">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">Versão</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Criada em</th>
                      <th className="px-3 py-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version) => (
                      <tr key={version.id} className="border-t">
                        <td className="px-3 py-2 font-mono">v{version.version}</td>
                        <td className="px-3 py-2">
                          {version.isActive ? (
                            <Badge className="bg-emerald-600">Ativa</Badge>
                          ) : (
                            <Badge variant="outline">Histórica</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString(version.language === "pt-BR" ? "pt-BR" : "en-US")}
                        </td>
                        <td className="px-3 py-2">
                          <Form method="post">
                            <input type="hidden" name="_action" value="rollback" />
                            <input type="hidden" name="language" value={selectedLanguage} />
                            <input type="hidden" name="versionId" value={version.id} />
                            <Button type="submit" variant="outline" size="sm" disabled={version.isActive || isSubmitting}>
                              Restaurar
                            </Button>
                          </Form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
