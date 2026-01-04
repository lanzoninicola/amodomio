import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";

type ActionData = { error?: string };

export async function loader({ }: LoaderFunctionArgs) {
  return json({});
}

export const meta: MetaFunction = () => [{ title: "CRM - Novo cliente" }];

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const form = await request.formData();
  const phone = String(form.get("phone") || "").trim();
  const name = String(form.get("name") || "").trim();
  if (!phone) return json<ActionData>({ error: "Telefone é obrigatório" }, { status: 400 });
  if (!name) return json<ActionData>({ error: "Nome é obrigatório" }, { status: 400 });

  const phone_e164 = normalize_phone_e164_br(phone);
  if (!phone_e164) return json<ActionData>({ error: "Telefone inválido" }, { status: 400 });

  const existing = await prisma.crmCustomer.findUnique({ where: { phone_e164 } });
  if (existing) {
    return json<ActionData>({ error: "Cliente já existe para este telefone" }, { status: 409 });
  }

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

  const customer = await prisma.crmCustomer.create({
    data: {
      phone_e164,
      name,
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
      customer_id: customer.id,
      event_type: "PROFILE_CREATE",
      source: "admin-ui",
      payload: { action: "customer_create", source: "admin-ui" },
      payload_raw: "customer_create",
    },
  });

  return redirect(`/admin/crm/${customer.id}/profile`);
}

export default function AdminCrmNewCustomer() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 font-neue">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">CRM</p>
          <h1 className="text-2xl font-semibold">Novo cliente (completo)</h1>
          <p className="text-sm text-muted-foreground">Preencha dados de contato, perfil e LGPD.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/crm#quick-create">Cadastro rápido</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/admin/crm">Voltar</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados principais</CardTitle>
          <CardDescription>Telefone é obrigatório e único (E.164 ou BR).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {actionData?.error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionData.error}
            </div>
          )}
          <Form method="post" className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">Telefone (E.164 ou BR)</label>
                <Input name="phone" placeholder="+5544999999999" required />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">Nome</label>
                <Input name="name" placeholder="Nome do cliente" required />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">Email</label>
                <Input name="email" type="email" placeholder="cliente@email.com" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">Canal preferencial</label>
                <Select name="preferred_channel" defaultValue="unknown">
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
                <Select name="gender" defaultValue="unknown">
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
                <Input name="profession" placeholder="Profissão" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase text-muted-foreground">Faixa etária</label>
                <Select name="age_profile" defaultValue="unknown">
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
                <Select name="preferred_payment_method" defaultValue="unknown">
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
              <label className="text-xs uppercase text-muted-foreground">Último endereço (JSON)</label>
              <Textarea
                name="delivery_address_last"
                placeholder='{"street":"Rua X","number":"123"}'
                rows={4}
              />
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1">
                  <label className="text-xs uppercase text-muted-foreground">Bairro</label>
                  <Input name="neighborhood" />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs uppercase text-muted-foreground">Cidade</label>
                  <Input name="city" />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs uppercase text-muted-foreground">CEP</label>
                  <Input name="postal_code" />
                </div>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[auto,1fr] md:items-center">
              <div className="flex items-center gap-2">
                <Checkbox name="lgpd_consent" id="lgpd_consent" />
                <label htmlFor="lgpd_consent" className="text-sm">
                  Consentimento LGPD
                </label>
              </div>
              <div className="grid gap-1 md:max-w-xs">
                <label className="text-xs uppercase text-muted-foreground">Data de consentimento</label>
                <Input type="datetime-local" name="consent_at" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Criar cliente"}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
