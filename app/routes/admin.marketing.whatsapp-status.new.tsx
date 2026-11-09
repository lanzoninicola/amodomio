import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authenticator } from "~/domain/auth/google.server";
import {
  normalizeStatusKind,
  type StatusPublicationKind,
} from "~/domain/whatsapp-status/whatsapp-status-publication.shared";
import { handleRouteError } from "~/domain/z-api/route-helpers.server";

export const meta: MetaFunction = () => [
  { title: "Novo post | Whatsapp Status" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const form = await request.formData();
  const { createStatusPublication } = await import(
    "~/domain/whatsapp-status/whatsapp-status-publication.server"
  );

  try {
    const publication = await createStatusPublication({
      title: String(form.get("title") || ""),
      kind: normalizeStatusKind(form.get("kind")),
      message: String(form.get("message") || ""),
      imageUrl: String(form.get("imageUrl") || ""),
      videoUrl: String(form.get("videoUrl") || ""),
      caption: String(form.get("caption") || ""),
      active: String(form.get("active") || "") === "true",
    });

    return redirect(`/admin/marketing/whatsapp-status/${publication.id}`);
  } catch (error: any) {
    const response = handleRouteError(error);
    const body = await response.json();
    return json(
      { ok: false, message: body?.error || "Erro ao criar post." },
      { status: response.status }
    );
  }
}

export default function AdminMarketingWhatsappStatusNew() {
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const [kind, setKind] = useState<StatusPublicationKind>("text");
  const [active, setActive] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Novo post de Status
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um texto, imagem ou vídeo para publicar no Status do
            WhatsApp.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/marketing/whatsapp-status">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      {actionData?.message ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionData.message}
        </div>
      ) : null}

      <Form method="post" className="grid gap-5 ">
        <input type="hidden" name="active" value={active ? "true" : "false"} />

        <div className="grid gap-2">
          <Label htmlFor="title">Nome do post</Label>
          <Input
            id="title"
            name="title"
            required
            placeholder="Ex.: Status almoço de terça"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div>
            <Label className="text-sm font-medium">Post habilitado</Label>
            <div className="text-xs text-muted-foreground">
              Posts habilitados podem ser chamados pelo agendador externo.
            </div>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>

        <div className="grid gap-2">
          <Label>Tipo de status</Label>
          <Select
            name="kind"
            value={kind}
            onValueChange={(value) => setKind(normalizeStatusKind(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === "text" ? (
          <div className="grid gap-2">
            <Label htmlFor="message">Texto do status</Label>
            <Textarea
              id="message"
              name="message"
              rows={8}
              placeholder="Texto que será publicado no Status"
            />
          </div>
        ) : kind === "image" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="imageUrl">URL pública da imagem</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                placeholder="https://seu-dominio.com/imagem.jpg"
              />
              <p className="text-xs text-muted-foreground">
                A Z-API aceita link público da imagem ou Base64. Prefira URL do
                servidor de mídia.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="caption">Legenda</Label>
              <Input
                id="caption"
                name="caption"
                placeholder="Legenda opcional"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="videoUrl">URL pública do vídeo</Label>
              <Input
                id="videoUrl"
                name="videoUrl"
                placeholder="https://seu-dominio.com/video.mp4"
              />
              <p className="text-xs text-muted-foreground">
                Use H.264 e mantenha o arquivo em até 100 MB para Status.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="caption">Legenda</Label>
              <Input
                id="caption"
                name="caption"
                placeholder="Legenda opcional"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            Criar post
          </Button>
        </div>
      </Form>
    </div>
  );
}
