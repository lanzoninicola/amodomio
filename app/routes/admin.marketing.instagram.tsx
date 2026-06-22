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
import { CheckCircle2, ExternalLink, Instagram, RefreshCw } from "lucide-react";
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
import { authenticator } from "~/domain/auth/google.server";
import {
  disconnectInstagram,
  getInstagramConnection,
  getInstagramFacebookConfig,
  verifyInstagramConnection,
} from "~/domain/instagram/instagram-facebook-login.server";

type ActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

export const meta: MetaFunction = () => [{ title: "Instagram | Marketing" }];

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  return json({
    config: getInstagramFacebookConfig(),
    connection: await getInstagramConnection(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const form = await request.formData();
  const intent = String(form.get("_intent") || "");

  try {
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

      <Card>
        <CardHeader>
          <CardTitle>Configuração do aplicativo Meta</CardTitle>
          <CardDescription>
            Estes valores devem ser configurados como secrets no ambiente do
            servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <ConfigRow label="App ID" ready={Boolean(config.appId)} />
          <ConfigRow label="App Secret" ready={config.appSecretConfigured} />
          <ConfigRow
            label="Chave de criptografia"
            ready={config.encryptionConfigured}
          />
          <ConfigRow
            label="Callback OAuth"
            ready={Boolean(config.callbackUrl)}
          />
          <div className="sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              URI para cadastrar na Meta
            </div>
            <code className="mt-1 block break-all rounded bg-slate-100 p-2 text-xs">
              {config.callbackUrl ||
                "META_FACEBOOK_CALLBACK_URL ainda não configurada"}
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
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
        <CardContent className="space-y-5">
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
              Configure os secrets indicados acima antes de iniciar o login.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border p-3">
      <span>{label}</span>
      <Badge variant={ready ? "default" : "outline"}>
        {ready ? "Configurado" : "Pendente"}
      </Badge>
    </div>
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
