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
  useSearchParams,
} from "@remix-run/react";
import {
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Instagram,
  RefreshCw,
  Save,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { authenticator } from "~/domain/auth/google.server";
import {
  disconnectInstagram,
  getInstagramConnection,
  getInstagramFacebookConfig,
  verifyInstagramConnection,
} from "~/domain/instagram/instagram-facebook-login.server";
import { saveInstagramSettings } from "~/domain/instagram/instagram-settings.server";

type ActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

const DEFAULT_CALLBACK_URL =
  "https://amodomio.com.br/auth/facebook-business/callback";
const TUNNEL_COMMAND = "cloudflared tunnel --url http://localhost:3000";
const FACEBOOK_BUSINESS_CALLBACK_PATH = "/auth/facebook-business/callback";

export const meta: MetaFunction = () => [{ title: "Instagram | Marketing" }];

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function str(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  return json({
    config: await getInstagramFacebookConfig(),
    connection: await getInstagramConnection(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const form = await request.formData();
  const intent = String(form.get("_intent") || "");

  try {
    if (intent === "save-settings") {
      await saveInstagramSettings({
        appId: str(form, "appId"),
        callbackUrl: str(form, "callbackUrl"),
        configId: str(form, "configId"),
        facebookPageId: str(form, "facebookPageId"),
        graphApiVersion: str(form, "graphApiVersion"),
        storyStatusMaxAttempts: str(form, "storyStatusMaxAttempts"),
        storyStatusIntervalMs: str(form, "storyStatusIntervalMs"),
      });
      return json<ActionData>({
        ok: true,
        message: "Configurações do Instagram salvas.",
      });
    }
    if (intent === "verify") {
      await verifyInstagramConnection();
      return json<ActionData>({
        ok: true,
        message: "Conexão validada com a Meta.",
      });
    }
    if (intent === "disconnect") {
      await disconnectInstagram();
      return json<ActionData>({
        ok: true,
        message: "Conexão removida deste sistema.",
      });
    }
    return json<ActionData>(
      { ok: false, message: "Ação inválida." },
      { status: 400 }
    );
  } catch (error) {
    return json<ActionData>(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível executar a ação.",
      },
      { status: 500 }
    );
  }
}

export default function AdminMarketingInstagramPage() {
  const { config, connection } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const callbackInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const callbackStatus = searchParams.get("status");
  const callbackMessage = searchParams.get("message");
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-4xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Instagram className="h-6 w-6" />
          Instagram
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte a conta profissional usada para publicar Stories dos destaques
          do cardápio.
        </p>
      </div>

      {callbackStatus === "connected" ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Conta conectada</AlertTitle>
          <AlertDescription>
            A Página e a conta profissional foram identificadas e o token foi
            armazenado de forma criptografada.
          </AlertDescription>
        </Alert>
      ) : null}

      {callbackStatus === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Falha na conexão</AlertTitle>
          <AlertDescription>
            {callbackMessage ||
              "Confira as permissões, a Página selecionada e tente novamente."}
          </AlertDescription>
        </Alert>
      ) : null}

      {actionData ? (
        <Alert variant={actionData.ok ? "default" : "destructive"}>
          <AlertTitle>{actionData.ok ? "Concluído" : "Erro"}</AlertTitle>
          <AlertDescription>{actionData.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-0 shadow-none">
        <CardHeader className="p-0">
          <CardTitle>Configuração do aplicativo Meta</CardTitle>
          <CardDescription>
            Estes valores operacionais ficam no banco e podem ser alterados sem
            mexer no ambiente do servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Form method="post" className="space-y-5">
            <input type="hidden" name="_intent" value="save-settings" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="App ID" name="appId" defaultValue={config.appId} />
              <Field
                label="ID da configuração de login"
                name="configId"
                defaultValue={config.configId}
                placeholder="Opcional"
              />
              <Field
                label="ID da Página Facebook"
                name="facebookPageId"
                defaultValue={config.facebookPageId}
                placeholder="Recomendado"
              />
              <Field
                label="Versão Graph API"
                name="graphApiVersion"
                defaultValue={config.graphApiVersion}
              />
              <Field
                label="Tentativas de status do Story"
                name="storyStatusMaxAttempts"
                defaultValue={String(config.storyStatusMaxAttempts)}
                type="number"
                min="1"
              />
              <Field
                label="Intervalo entre tentativas (ms)"
                name="storyStatusIntervalMs"
                defaultValue={String(config.storyStatusIntervalMs)}
                type="number"
                min="250"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="callbackUrl">Callback OAuth</Label>
                  <TunnelHelpDialog />
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    if (callbackInputRef.current) {
                      callbackInputRef.current.value = DEFAULT_CALLBACK_URL;
                    }
                  }}
                >
                  Default
                </Button>
              </div>
              <Input
                ref={callbackInputRef}
                id="callbackUrl"
                name="callbackUrl"
                defaultValue={config.callbackUrl}
                placeholder="http://localhost:3000/auth/facebook-business/callback"
              />
              <p className="text-xs text-muted-foreground">
                Cadastre exatamente esta URL no app da Meta. Para túnel local,
                substitua o domínio pelo endereço público do túnel.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                Salvar configurações
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-0 shadow-none">
        <CardHeader className="p-0">
          <CardTitle>Secrets do ambiente</CardTitle>
          <CardDescription>
            Permanecem no env porque protegem o app, o cookie temporário e os
            tokens gravados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 p-0 text-sm">
          <ConfigRow label="App Secret" ready={config.appSecretConfigured} />
          <Separator />
          <ConfigRow
            label="Chave de criptografia"
            ready={config.encryptionConfigured}
          />
          <Separator />
          <ConfigRow
            label="Cookie OAuth"
            ready={config.oauthCookieSecretConfigured}
          />
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-0 shadow-none">
        <CardHeader className="p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Conta conectada</CardTitle>
              <CardDescription>
                A publicação de Stories usará esta conta profissional.
              </CardDescription>
            </div>
            <Badge variant={connection ? "default" : "outline"}>
              {connection ? "Conectada" : "Não conectada"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-0">
          {connection ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail
                label="Página"
                value={`${connection.facebookPageName} (${connection.facebookPageId})`}
              />
              <Detail
                label="Instagram"
                value={`@${connection.instagramUsername || "sem usuário"} (${
                  connection.instagramAccountId
                })`}
              />
              <Detail
                label="Token válido até"
                value={formatDate(connection.tokenExpiresAt)}
              />
              <Detail
                label="Última verificação"
                value={formatDate(connection.lastVerifiedAt)}
              />
              {connection.lastError ? (
                <Detail label="Último erro" value={connection.lastError} />
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-slate-600">
              Nenhuma conta foi conectada neste ambiente.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {config.ready ? (
              <Button asChild>
                <Link to="/auth/facebook-business">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {connection
                    ? "Reconectar com Facebook"
                    : "Conectar com Facebook"}
                </Link>
              </Button>
            ) : (
              <Button type="button" disabled>
                <ExternalLink className="mr-2 h-4 w-4" />
                Conectar com Facebook
              </Button>
            )}

            {connection ? (
              <>
                <Form method="post">
                  <Button
                    type="submit"
                    name="_intent"
                    value="verify"
                    variant="outline"
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar conexão
                  </Button>
                </Form>
                <Form method="post">
                  <Button
                    type="submit"
                    name="_intent"
                    value="disconnect"
                    variant="outline"
                    disabled={isSubmitting}
                    className="w-full text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    Desconectar
                  </Button>
                </Form>
              </>
            ) : null}
          </div>

          {!config.ready ? (
            <p className="text-xs text-amber-700">
              Configure os campos do app Meta e os secrets do ambiente antes de
              iniciar o login.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <span>{label}</span>
      <Badge variant={ready ? "default" : "outline"}>
        {ready ? "Configurado" : "Pendente"}
      </Badge>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  min,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  type?: string;
  min?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        min={min}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}

function TunnelHelpDialog() {
  const [tunnelUrl, setTunnelUrl] = useState("");
  const normalizedTunnelUrl = tunnelUrl.trim().replace(/\/+$/g, "");
  const callbackUrl = useMemo(() => {
    if (!normalizedTunnelUrl) {
      return `https://URL-DO-TUNEL${FACEBOOK_BUSINESS_CALLBACK_PATH}`;
    }
    return `${normalizedTunnelUrl}${FACEBOOK_BUSINESS_CALLBACK_PATH}`;
  }, [normalizedTunnelUrl]);
  const copyText = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Ajuda para ativar túnel local"
        >
          <CircleHelp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Callback com túnel local</DialogTitle>
          <DialogDescription>
            Use isto quando a Meta precisar chamar seu ambiente local durante o
            teste de login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded border bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Comando
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(TUNNEL_COMMAND)}
              >
                Copiar
              </Button>
            </div>
            <code className="block break-all text-xs">{TUNNEL_COMMAND}</code>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tunnelUrl">URL escolhida/gerada pelo túnel</Label>
            <Input
              id="tunnelUrl"
              value={tunnelUrl}
              onChange={(event) => setTunnelUrl(event.target.value)}
              placeholder="https://exemplo.trycloudflare.com"
            />
          </div>

          <div className="rounded bg-slate-100 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Callback montado
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(callbackUrl)}
              >
                Copiar
              </Button>
            </div>
            <code className="block break-all text-xs">{callbackUrl}</code>
          </div>
          <p className="text-slate-700">
            Essa mesma URL precisa estar cadastrada no app da Meta como redirect
            OAuth válido.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-slate-900">{value}</dd>
    </div>
  );
}
