import {
  json,
  redirect,
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
import { AlertTriangle, Bot, CheckCircle2, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  getWhatsappAgentSettings,
  saveWhatsappAgentSettings,
  type WhatsappAgentSettingName,
} from "~/domain/whatsapp-agent/whatsapp-agent-settings.server";

type AgentMode = "test" | "approval" | "auto";
type AgentProvider = "openrouter" | "openai";

export const meta: MetaFunction = () => [
  { title: "Agente de atendimento AI | A Modo Mio" },
];

function integerField(
  form: FormData,
  name: string,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(form.get(name));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} deve estar entre ${min} e ${max}.`);
  }
  return String(parsed || fallback);
}

function normalizePhone(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const settings = await getWhatsappAgentSettings();
  const saved = new URL(request.url).searchParams.get("saved") === "1";
  return json({ settings, saved });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const enabled = form.get("enabled") === "on";
  const mode = String(form.get("mode") || "test") as AgentMode;
  const provider = String(
    form.get("provider") || "openrouter"
  ) as AgentProvider;
  const testPhone = normalizePhone(form.get("testPhone"));
  const model = String(form.get("model") || "").trim();
  const currentSettings = await getWhatsappAgentSettings();

  const errors: string[] = [];
  if (!["test", "approval", "auto"].includes(mode))
    errors.push("Modo invalido.");
  if (!["openrouter", "openai"].includes(provider))
    errors.push("Provedor invalido.");
  if (
    enabled &&
    mode === "test" &&
    (testPhone.length < 10 || testPhone.length > 15)
  ) {
    errors.push("Informe o telefone de teste com DDI e DDD.");
  }
  if (provider === "openrouter" && mode !== "test") {
    errors.push("OpenRouter e permitido somente no modo de teste.");
  }
  if (!model || model.length > 150) errors.push("Informe um modelo valido.");

  let numericValues: Record<string, string> = {};
  try {
    numericValues = {
      pollIntervalMs: integerField(form, "pollIntervalMs", 2_000, 500, 60_000),
      lockSeconds: integerField(form, "lockSeconds", 120, 30, 900),
      maxAttempts: integerField(form, "maxAttempts", 5, 1, 10),
      historyLimit: integerField(form, "historyLimit", 8, 1, 30),
      maxJobAgeMinutes: integerField(form, "maxJobAgeMinutes", 15, 1, 1_440),
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Valores numericos invalidos."
    );
  }

  if (errors.length) return json({ errors }, { status: 400 });

  await saveWhatsappAgentSettings({
    enabled: String(enabled),
    mode,
    testPhone,
    provider,
    model,
    pollIntervalMs: numericValues.pollIntervalMs,
    lockSeconds: numericValues.lockSeconds,
    maxAttempts: numericValues.maxAttempts,
    historyLimit: numericValues.historyLimit,
    maxJobAgeMinutes: numericValues.maxJobAgeMinutes,
    businessInstructions: currentSettings.businessInstructions,
  } satisfies Record<WhatsappAgentSettingName, string>);

  return redirect("/admin/ai/agente-atendimento?saved=1");
}

function FieldHelp({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
  );
}

export default function WhatsappAiAgentSettingsPage() {
  const { settings, saved } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 rounded-xl border bg-gradient-to-br from-muted/60 via-background to-muted/30 p-6 md:flex-row md:items-start">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            AI / WhatsApp
          </p>
          <h1 className="flex items-center gap-3 text-3xl font-semibold">
            <Bot className="h-8 w-8" /> Agente de atendimento
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Controle o worker hospedado no Dokploy. As configuracoes abaixo sao
            salvas diretamente no contexto
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5">
              whatsapp-ai-agent
            </code>
            da tabela settings e entram em vigor sem novo deploy.
          </p>
        </div>
      </div>

      {saved ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Configuracoes salvas.
        </div>
      ) : null}
      {actionData?.errors?.length ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionData.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Operacao e seguranca</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="enabled">Agente ativo</Label>
                <FieldHelp>
                  Desative para interromper novos processamentos sem parar o
                  container.
                </FieldHelp>
              </div>
              <Switch
                id="enabled"
                name="enabled"
                defaultChecked={settings.enabled === "true"}
              />
            </div>
            <div className="space-y-2">
              <Label>Modo de operacao</Label>
              <Select name="mode" defaultValue={settings.mode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">
                    Teste - responde um telefone
                  </SelectItem>
                  <SelectItem value="approval">
                    Aprovacao - gera sem enviar
                  </SelectItem>
                  <SelectItem value="auto">
                    Automatico - envia aos clientes
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldHelp>
                Comece em teste. OpenRouter fica bloqueado fora desse modo.
              </FieldHelp>
            </div>
            <div className="space-y-2">
              <Label htmlFor="testPhone">Telefone autorizado no teste</Label>
              <Input
                id="testPhone"
                name="testPhone"
                defaultValue={settings.testPhone}
                placeholder="5546999999999"
                inputMode="tel"
              />
              <FieldHelp>
                Use somente um numero com DDI e DDD. Outros telefones nao sao
                reservados pelo worker.
              </FieldHelp>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Antes de ativar
              </p>
              <p className="mt-2 text-xs leading-relaxed">
                Confirme a migration, o worker saudavel no Dokploy e o telefone
                de teste. Segredos nunca sao gravados nesta tela.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provedor e modelo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select name="provider" defaultValue={settings.provider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">
                    OpenRouter - somente teste
                  </SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
              <FieldHelp>
                As chaves OPENROUTER_API_KEY e OPENAI_API_KEY ficam somente no
                Dokploy.
              </FieldHelp>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                name="model"
                defaultValue={settings.model}
                placeholder="openrouter/free"
              />
              <FieldHelp>
                Para o teste gratuito use openrouter/free. A disponibilidade e a
                qualidade podem variar.
              </FieldHelp>
            </div>
            <div className="space-y-3 rounded-lg border p-4 md:col-span-2">
              <div>
                <Label>Conhecimento e instruções</Label>
                <FieldHelp>
                  Identidade, tom, regras, cardápio, horários e entregas são
                  administrados em uma fonte central reutilizável por todos os
                  agentes.
                </FieldHelp>
              </div>
              <Button asChild type="button" variant="outline">
                <Link to="/admin/ai/conhecimento">
                  Gerenciar conhecimento da empresa
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processamento do worker</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              [
                "pollIntervalMs",
                "Consulta (ms)",
                settings.pollIntervalMs,
                "500",
                "60000",
              ],
              [
                "lockSeconds",
                "Lock (segundos)",
                settings.lockSeconds,
                "30",
                "900",
              ],
              ["maxAttempts", "Tentativas", settings.maxAttempts, "1", "10"],
              ["historyLimit", "Historico", settings.historyLimit, "1", "30"],
              [
                "maxJobAgeMinutes",
                "Validade (min)",
                settings.maxJobAgeMinutes,
                "1",
                "1440",
              ],
            ].map(([name, label, value, min, max]) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  name={name}
                  type="number"
                  defaultValue={value}
                  min={min}
                  max={max}
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-5 rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
              Consulta controla a frequencia do banco; lock permite recuperar
              jobs presos; tentativas usa backoff; historico limita conversas
              enviadas somente a OpenAI; validade impede respostas atrasadas.
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FlaskConical className="h-4 w-4" /> Salve em modo teste antes de
            enviar a primeira mensagem.
          </p>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar configuracoes"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
