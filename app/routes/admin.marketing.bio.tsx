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
import { ExternalLink, Link2, Save } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { authenticator } from "~/domain/auth/google.server";
import {
  ensureBioSettings,
  readBioSettings,
  saveBioSettings,
} from "~/domain/bio/bio-settings.server";

export const meta: MetaFunction = () => [{ title: "Bio | Marketing" }];

type ActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

function field(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  await ensureBioSettings();
  return json({ settings: await readBioSettings() });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const formData = await request.formData();
  const headline = field(formData, "headline");
  const description = field(formData, "description");

  if (!headline || !description) {
    return json<ActionData>(
      { ok: false, message: "Preencha os dois textos da Bio." },
      { status: 400 }
    );
  }
  if (headline.length > 80 || description.length > 240) {
    return json<ActionData>(
      {
        ok: false,
        message: "O título aceita até 80 e a descrição até 240 caracteres.",
      },
      { status: 400 }
    );
  }

  await saveBioSettings({ headline, description });
  return json<ActionData>({ ok: true, message: "Textos da Bio salvos." });
}

export default function AdminMarketingBioPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link2 className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-semibold tracking-tight">Bio</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Edite a apresentação exibida acima dos links públicos.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link to="/bio" target="_blank" rel="noreferrer">
            Abrir Bio
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </header>

      <Form method="post" className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="headline">Título</Label>
          <Input
            id="headline"
            name="headline"
            defaultValue={settings.headline}
            maxLength={80}
            required
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            Frase principal apresentada logo abaixo da marca.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={settings.description}
            maxLength={240}
            required
            rows={4}
            className="resize-y text-base"
          />
          <p className="text-xs text-muted-foreground">
            Texto curto que explica a proposta da A Modo Mio.
          </p>
        </div>

        {actionData ? (
          <p
            role="status"
            className={
              actionData.ok
                ? "text-sm font-medium text-emerald-700"
                : "text-sm font-medium text-destructive"
            }
          >
            {actionData.message}
          </p>
        ) : null}

        <Button type="submit" disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar textos"}
        </Button>
      </Form>
    </main>
  );
}
