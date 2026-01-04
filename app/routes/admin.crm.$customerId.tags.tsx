import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import prisma from "~/lib/prisma/client.server";

type LoaderData = {
  tags: { id: string; key: string; label: string | null }[];
  allTags: { key: string; label: string | null }[];
};

type Context = { customer: { id: string; name: string; phone_e164: string } };

export async function loader({ params }: LoaderFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) throw new Response("not found", { status: 404 });

  const links = await prisma.crmCustomerTagLink.findMany({
    where: { customer_id: customerId },
    include: { tag: true },
  });

  const allTags = await prisma.crmCustomerTag.findMany({
    orderBy: { key: "asc" },
    select: { key: true, label: true },
  });

  return json<LoaderData>({
    tags: links.map((l) => ({
      id: l.id,
      key: l.tag.key,
      label: l.tag.label,
    })),
    allTags,
  });
}

type ActionData = { error?: string };

export const meta: MetaFunction = () => [{ title: "CRM - Tags" }];

export async function action({ request, params }: ActionFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) return json({ error: "not_found" }, { status: 404 });

  const form = await request.formData();
  const intent = String(form.get("_intent") || "");

  if (intent === "remove_tag") {
    const linkId = String(form.get("tag_link_id") || "").trim();
    if (!linkId) return json<ActionData>({ error: "Tag inválida" }, { status: 400 });
    await prisma.crmCustomerTagLink.delete({ where: { id: linkId } });
    return redirect(`/admin/crm/${customerId}/tags`);
  }

  const key = String(form.get("tag_key") || "").trim();
  const label = String(form.get("tag_label") || "").trim() || null;
  const quickKey = String(form.get("quick_tag") || "").trim();

  const chosenKey = quickKey || key;
  const chosenLabel = label || null;

  if (!chosenKey) return json<ActionData>({ error: "Tag obrigatória" }, { status: 400 });

  const tag = await prisma.crmCustomerTag.upsert({
    where: { key: chosenKey },
    update: { label: chosenLabel ?? undefined },
    create: { key: chosenKey, label: chosenLabel },
  });

  await prisma.crmCustomerTagLink.upsert({
    where: { customer_id_tag_id: { customer_id: customerId, tag_id: tag.id } },
    update: {},
    create: { customer_id: customerId, tag_id: tag.id },
  });

  return redirect(`/admin/crm/${customerId}/tags`);
}

export default function AdminCrmCustomerTags() {
  const { tags, allTags } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  useOutletContext<Context>();

  return (
    <Card className="font-neue">
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>Classifique o cliente para segmentar campanhas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actionData?.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionData.error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tags.length ? (
            tags.map((t) => (
              <Form method="post" key={t.id} className="group relative inline-flex">
                <input type="hidden" name="_intent" value="remove_tag" />
                <input type="hidden" name="tag_link_id" value={t.id} />
                <Badge
                  variant="outline"
                  className="text-xs pr-5 transition"
                  title="Clique para remover"
                >
                  {t.label || t.key}
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full px-1 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100">
                    ×
                  </span>
                </Badge>
              </Form>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma tag.</p>
          )}
        </div>

        <Form method="post" className="grid gap-2 md:grid-cols-2 md:items-end">
          <input type="hidden" name="_intent" value="add_tag" />
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tag (key)</label>
            <Input
              name="tag_key"
              placeholder="vip, churn-risk, newsletter"
              list="crm-existing-tags"
              required
            />
            <datalist id="crm-existing-tags">
              {allTags.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label || t.key}
                </option>
              ))}
            </datalist>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Label (opcional)</label>
            <Input name="tag_label" placeholder="VIP" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Adicionar tag"}
            </Button>
          </div>
        </Form>

        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Tags existentes</p>
          <div className="flex flex-wrap gap-2">
            {allTags.length ? (
              allTags.map((t) => (
                <Form method="post" key={t.key}>
                  <input type="hidden" name="_intent" value="add_tag" />
                  <input type="hidden" name="quick_tag" value={t.key} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={isSubmitting}
                  >
                    {t.label || t.key}
                  </Button>
                </Form>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada ainda.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
