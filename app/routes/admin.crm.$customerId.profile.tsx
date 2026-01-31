import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageOff } from "lucide-react";
import prisma from "~/lib/prisma/client.server";
import { useLoaderData, useNavigation, useActionData } from "@remix-run/react";

type LoaderData = {
  customer: {
    id: string;
    name: string | null;
    phone_e164: string;
    created_at: string;
    updated_at: string;
    email: string | null;
    preferred_channel: string | null;
    first_order_at: string | null;
    last_order_at: string | null;
    orders_count: number;
    total_revenue: number;
    avg_ticket: number;
    lgpd_consent: boolean;
    consent_at: string | null;
    delivery_address_last: string | null;
    neighborhood: string | null;
    city: string | null;
    postal_code: string | null;
    gender: string;
    profession: string | null;
    age_profile: string;
    preferred_payment_method: string;
    images: Array<{
      id: string;
      url: string | null;
      description: string | null;
      created_at: string;
    }>;
  };
};

export async function loader({ params }: LoaderFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) throw new Response("not found", { status: 404 });

  const customer = await prisma.crmCustomer.findUnique({
    where: { id: customerId },
  });
  if (!customer) throw new Response("not found", { status: 404 });

  const images = await prisma.crmCustomerImage.findMany({
    where: { customer_id: customerId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      url: true,
      description: true,
      created_at: true,
    },
  });

  return json<LoaderData>({
    customer: {
      id: customer.id,
      name: customer.name,
      phone_e164: customer.phone_e164,
      created_at: customer.created_at.toISOString(),
      updated_at: customer.updated_at.toISOString(),
      email: customer.email,
      preferred_channel: customer.preferred_channel,
      first_order_at: customer.first_order_at ? customer.first_order_at.toISOString() : null,
      last_order_at: customer.last_order_at ? customer.last_order_at.toISOString() : null,
      orders_count: customer.orders_count,
      total_revenue: Number(customer.total_revenue),
      avg_ticket: Number(customer.avg_ticket),
      lgpd_consent: customer.lgpd_consent,
      consent_at: customer.consent_at ? customer.consent_at.toISOString() : null,
      delivery_address_last: customer.delivery_address_last
        ? JSON.stringify(customer.delivery_address_last, null, 2)
        : null,
      neighborhood: customer.neighborhood,
      city: customer.city,
      postal_code: customer.postal_code,
      gender: customer.gender,
      profession: customer.profession,
      age_profile: customer.age_profile,
      preferred_payment_method: customer.preferred_payment_method,
      images: images.map((image) => ({
        id: image.id,
        url: image.url,
        description: image.description,
        created_at: image.created_at.toISOString(),
      })),
    },
  });
}

export const meta: MetaFunction = () => [{ title: "CRM - Dados" }];

type ActionData = { error?: string };

export async function action({ request, params }: ActionFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) return json({ error: "not_found" }, { status: 404 });

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();

  const email = String(form.get("email") || "").trim() || null;
  const preferred_channel_raw = String(form.get("preferred_channel") || "").trim();
  const preferred_channel = ["whatsapp", "phone", "unknown"].includes(preferred_channel_raw)
    ? preferred_channel_raw
    : "unknown";
  const gender_raw = String(form.get("gender") || "unknown").trim() || "unknown";
  const gender = ["female", "male", "unknown"].includes(gender_raw) ? gender_raw : "unknown";
  const profession = String(form.get("profession") || "").trim() || null;
  const age_profile_raw = String(form.get("age_profile") || "unknown").trim() || "unknown";
  const age_profile = ["young", "adult", "senior", "unknown"].includes(age_profile_raw)
    ? age_profile_raw
    : "unknown";
  const preferred_payment_method_raw = String(form.get("preferred_payment_method") || "unknown").trim() || "unknown";
  const preferred_payment_method = ["pix", "card", "cash", "unknown"].includes(preferred_payment_method_raw)
    ? preferred_payment_method_raw
    : "unknown";

  const neighborhood = String(form.get("neighborhood") || "").trim() || null;
  const city = String(form.get("city") || "").trim() || null;
  const postal_code = String(form.get("postal_code") || "").trim() || null;

  const lgpd_consent = form.get("lgpd_consent") === "on";
  const consent_at_raw = String(form.get("consent_at") || "").trim();
  const consent_at = consent_at_raw ? new Date(consent_at_raw) : null;
  if (consent_at && isNaN(consent_at.getTime())) {
    return json<ActionData>({ error: "Data de consentimento inválida" }, { status: 400 });
  }

  const delivery_address_last_raw = String(form.get("delivery_address_last") || "").trim();
  let delivery_address_last: Record<string, unknown> | null = null;
  if (delivery_address_last_raw) {
    try {
      delivery_address_last = JSON.parse(delivery_address_last_raw);
    } catch {
      return json<ActionData>({ error: "delivery_address_last deve ser um JSON válido" }, { status: 400 });
    }
  }

  await prisma.crmCustomer.update({
    where: { id: customerId },
    data: {
      name: name || null,
      email,
      preferred_channel,
      gender,
      profession,
      age_profile,
      preferred_payment_method,
      neighborhood,
      city,
      postal_code,
      lgpd_consent,
      consent_at: lgpd_consent ? consent_at || new Date() : null,
      delivery_address_last,
    },
  });

  await prisma.crmCustomerEvent.create({
    data: {
      customer_id: customerId,
      event_type: "PROFILE_UPDATE",
      source: "admin-ui",
      payload: { action: "customer_update", source: "admin-ui" },
      payload_raw: "customer_update",
    },
  });

  return redirect(`/admin/crm/${customerId}/profile`);
}

export default function AdminCrmCustomerProfile() {
  const { customer } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const images = customer.images || [];
  const primaryImage = images[0];
  const galleryImages = primaryImage ? images.slice(1) : images;
  const hasValidImageUrl = (url: string | null | undefined) => {
    if (!url) return false;
    const normalized = url.trim().toLowerCase();
    return normalized !== "" && normalized !== "null" && normalized !== "undefined";
  };
  const consentInputValue = customer.consent_at
    ? (() => {
      const date = new Date(customer.consent_at);
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    })()
    : "";

  return (
    <Card className="font-neue">
      <CardHeader>
        <CardTitle>Dados do cliente</CardTitle>
        <CardDescription>Informações completas do cadastro.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 text-sm">
        {actionData?.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionData.error}
          </div>
        )}

        <div className="grid gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Imagem do perfil</p>
            <p className="text-sm text-muted-foreground">
              Últimas fotos recebidas do WhatsApp.
            </p>
          </div>
          {primaryImage ? (
            <div className="grid gap-4 md:grid-cols-[200px,1fr]">
              {hasValidImageUrl(primaryImage.url) ? (
                <a
                  href={primaryImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-lg border bg-muted/40"
                  title={primaryImage.description || "Foto do perfil"}
                >
                  <img
                    src={primaryImage.url}
                    alt={primaryImage.description || "Foto do perfil"}
                    className="h-52 w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <div className="flex h-52 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground">
                  <div className="grid justify-items-center gap-2 text-xs uppercase">
                    <ImageOff className="h-8 w-8" aria-hidden="true" />
                    <span>Sem imagem</span>
                  </div>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {galleryImages.map((image) => (
                  hasValidImageUrl(image.url) ? (
                    <a
                      key={image.id}
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-md border bg-muted/30"
                      title={image.description || "Foto do perfil"}
                    >
                      <img
                        src={image.url}
                        alt={image.description || "Foto do perfil"}
                        className="h-20 w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div
                      key={image.id}
                      className="flex h-20 items-center justify-center rounded-md border bg-muted/20 text-muted-foreground"
                      aria-label="Sem imagem"
                    >
                      <ImageOff className="h-4 w-4" aria-hidden="true" />
                    </div>
                  )
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
              Nenhuma imagem de perfil cadastrada.
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <Metric
            label="Primeiro pedido"
            value={customer.first_order_at ? new Date(customer.first_order_at).toLocaleString() : null}
            fallback="-"
          />
          <Metric
            label="Último pedido"
            value={customer.last_order_at ? new Date(customer.last_order_at).toLocaleString() : null}
            fallback="-"
          />
          <Metric label="Pedidos" value={customer.orders_count} />
          <Metric
            label="Ticket médio"
            value={
              customer.orders_count > 0
                ? `R$ ${customer.avg_ticket.toFixed(2)}`
                : "R$ 0,00"
            }
          />
          <Metric
            label="Receita total"
            value={`R$ ${customer.total_revenue.toFixed(2)}`}
          />
        </div>

        <form method="post" className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Nome</label>
              <Input name="name" defaultValue={customer.name || ""} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Telefone (E.164)</label>
              <Input value={customer.phone_e164} readOnly className="font-mono" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Email</label>
              <Input
                name="email"
                type="email"
                placeholder="cliente@email.com"
                defaultValue={customer.email || ""}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Canal preferencial</label>
              <Select name="preferred_channel" defaultValue={customer.preferred_channel || "unknown"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Não informado</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Gênero</label>
              <Select name="gender" defaultValue={customer.gender || "unknown"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Não informado</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Profissão</label>
              <Input name="profession" defaultValue={customer.profession || ""} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Faixa etária</label>
              <Select name="age_profile" defaultValue={customer.age_profile || "unknown"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Não informado</SelectItem>
                  <SelectItem value="young">Jovem</SelectItem>
                  <SelectItem value="adult">Adulto</SelectItem>
                  <SelectItem value="senior">Sênior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs uppercase text-muted-foreground">Pagamento preferido</label>
              <Select
                name="preferred_payment_method"
                defaultValue={customer.preferred_payment_method || "unknown"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Não informado</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Checkbox name="lgpd_consent" id="lgpd_consent" defaultChecked={customer.lgpd_consent} />
              <label htmlFor="lgpd_consent" className="text-sm">
                Consentimento LGPD
              </label>
            </div>
            <div className="grid gap-1 md:max-w-xs">
              <label className="text-xs uppercase text-muted-foreground">Data de consentimento</label>
              <Input type="datetime-local" name="consent_at" defaultValue={consentInputValue} />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-xs uppercase text-muted-foreground">Último endereço (JSON)</label>
            <Textarea
              name="delivery_address_last"
              placeholder='{"street":"Rua X","number":"123"}'
              defaultValue={customer.delivery_address_last || ""}
              rows={4}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">Bairro</label>
                <Input name="neighborhood" defaultValue={customer.neighborhood || ""} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">Cidade</label>
                <Input name="city" defaultValue={customer.city || ""} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">CEP</label>
                <Input name="postal_code" defaultValue={customer.postal_code || ""} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>Criação: {new Date(customer.created_at).toLocaleString()}</div>
          <div>Atualizado: {new Date(customer.updated_at).toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | number | null;
  fallback?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-base font-medium">
        {value === null || value === undefined || value === "" ? fallback ?? "-" : value}
      </p>
    </div>
  );
}
