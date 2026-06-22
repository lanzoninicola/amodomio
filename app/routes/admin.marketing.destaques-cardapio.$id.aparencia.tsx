import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const id = String(params.id || "");
  const section = await prismaClient.cardapioHighlightSection.findUnique({
    where: { id },
    select: {
      displayStyle: true,
      showTitle: true,
      showPromotionHint: true,
      published: true,
    },
  });
  if (!section) throw new Response("Destaque não encontrado", { status: 404 });

  return json({ section });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const form = await request.formData();
  const published = form.get("published") === "on";
  const displayStyle = String(form.get("displayStyle") || "polaroid");

  await prismaClient.cardapioHighlightSection.update({
    where: { id },
    data: {
      displayStyle: displayStyle === "default" ? "default" : "polaroid",
      showTitle: form.get("showTitle") === "on",
      showPromotionHint: form.get("showPromotionHint") === "on",
      published,
      deletedAt: null,
    },
  });

  await invalidateCardapioIndexCache();
  return json({ ok: true, message: "Aparência e visibilidade salvas." });
}

function SwitchRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={name} className="text-sm font-medium text-slate-900">
          {label}
        </Label>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch
        id={name}
        name={name}
        defaultChecked={defaultChecked}
        className="shrink-0"
      />
    </div>
  );
}

export default function CardapioHighlightAppearancePage() {
  const { section } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [published, setPublished] = useState(Boolean(section.published));

  return (
    <Form method="post" className="grid min-w-0 max-w-2xl gap-6">
      <div>
        <h2 className="text-lg font-semibold">Aparência e visibilidade</h2>
        <p className="text-sm text-slate-500">
          Estilo visual e publicação no cardápio público.
        </p>
      </div>

      {actionData?.message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionData.message}
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="displayStyle">Estilo visual</Label>
          <Select
            name="displayStyle"
            defaultValue={section.displayStyle || "polaroid"}
          >
            <SelectTrigger id="displayStyle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="polaroid">
                Foto instantânea (polaroid)
              </SelectItem>
              <SelectItem value="default">Padrão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SwitchRow
          name="showTitle"
          label="Mostrar título e subtítulo"
          description="Exibe o texto acima da imagem no mobile."
          defaultChecked={section.showTitle}
        />
        <SwitchRow
          name="showPromotionHint"
          label='Mostrar "Toque para ver a promoção"'
          description="Exibe a chamada promocional no cardápio."
          defaultChecked={section.showPromotionHint}
        />

        <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <Label htmlFor="published">Publicado</Label>
            <p className="text-xs text-slate-500">
              Quando desligado, o destaque não aparece no site.
            </p>
          </div>
          <Switch
            id="published"
            name="published"
            checked={published}
            onCheckedChange={setPublished}
            className="shrink-0"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={navigation.state === "submitting"}
          className="w-full sm:w-auto"
        >
          {navigation.state === "submitting"
            ? "Salvando..."
            : "Salvar aparência"}
        </Button>
      </div>
    </Form>
  );
}
