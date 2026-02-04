import { json } from "@remix-run/node";
import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useNavigation, useSearchParams } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "~/components/primitives/logo/logo";
import { env } from "@config/env";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";

type ActionData =
  | { ok: true; message: string }
  | { ok: false; error: string; field?: "phone" | "name" | "form" };

export const meta: MetaFunction = () => {
  return [{ title: "A Modo Mio | Cardápio" }];
};

const SETTINGS_CONTEXT = "cardapio-onboarding";
const DEFAULT_TEMPLATE =
  "Oi {name}! Segue o link do nosso cardápio: {menu_url}";

function formatPhoneBR(rawDigits: string) {
  const digits = rawDigits.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (!rest) return ddd ? `(${ddd}` : "";
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function applyTemplate(template: string, params: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function formatWhatsappName(name: string) {
  const safe = name.trim().replace(/\s+/g, " ");
  if (!safe) return "";
  return safe
    .split(" ")
    .map((part) => {
      const first = part.charAt(0).toUpperCase();
      const rest = part.slice(1).toLowerCase();
      if (!rest) return first;
      return `${first}\u200b*${rest}*`;
    })
    .join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addLineBreakAfterName(message: string, formattedName: string) {
  if (!formattedName || message.includes("\n")) return message;
  const namePattern = escapeRegExp(formattedName);
  const withBreak = message.replace(
    new RegExp(`${namePattern}[!,.?:;]?\\s+`),
    `${formattedName}\n`
  );
  if (withBreak !== message) return withBreak;
  return message.replace(formattedName, `${formattedName}\n`);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const form = await request.formData();
  const phone = String(form.get("phone") || "").trim();
  const name = String(form.get("name") || "").trim();
  const qr_id = String(form.get("qr_id") || "").trim();

  if (!phone) {
    return json({ ok: false, error: "invalid_phone", field: "phone" }, { status: 400 });
  }

  if (!name) {
    return json({ ok: false, error: "invalid_name", field: "name" }, { status: 400 });
  }

  const phoneE164 = normalize_phone_e164_br(phone);
  if (!phoneE164) {
    return json({ ok: false, error: "invalid_phone", field: "phone" }, { status: 400 });
  }

  const phoneDigits = phoneE164.replace("+", "");
  const origin = new URL(request.url);
  const baseUrl = `${origin.protocol}//${origin.host}`;

  const crmResponse = await fetch(`${baseUrl}/api/crm/customers/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, name, source: "CARDAPIO_ONBOARDING", qr_id: qr_id || undefined }),
  });

  if (!crmResponse.ok && crmResponse.status !== 409) {
    return json({ ok: false, error: "crm_error", field: "form" }, { status: 502 });
  }

  const settings = await settingPrismaEntity.findAllByContext(SETTINGS_CONTEXT);
  const settingsMap = new Map(settings.map((setting) => [setting.name, setting.value]));
  const menuUrl = settingsMap.get("menuUrl") || WEBSITE_LINKS.cardapioFallbackURL.href;
  const template = settingsMap.get("messageTemplate") || DEFAULT_TEMPLATE;
  const formattedName = formatWhatsappName(name);
  const messageRaw = applyTemplate(template, { name: formattedName, menu_url: menuUrl });
  const message = addLineBreakAfterName(messageRaw, formattedName);

  const messageResponse = await fetch(`${baseUrl}/api/messages/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.apiKey,
    },
    body: JSON.stringify({ phone: phoneDigits, message }),
  });

  if (!messageResponse.ok) {
    return json({ ok: false, error: "message_error", field: "form" }, { status: 502 });
  }

  return json({ ok: true, message: "Enviamos o cardápio no seu WhatsApp!" }, { status: 200 });
}

export default function CardapioOnboardingRoute() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state !== "idle";
  const [phoneInput, setPhoneInput] = useState("");
  const qrId = searchParams.get("qr_id") || searchParams.get("qr") || "";

  const status = useMemo(() => {
    if (!actionData) return null;
    if (actionData.ok) return { tone: "success", text: actionData.message };
    if (actionData.error === "invalid_phone") return { tone: "error", text: "Telefone inválido." };
    if (actionData.error === "invalid_name") return { tone: "error", text: "Informe seu nome." };
    if (actionData.error === "message_error") {
      return { tone: "error", text: "Não conseguimos enviar a mensagem agora." };
    }
    return { tone: "error", text: "Algo deu errado. Tente novamente." };
  }, [actionData]);

  return (
    <div className="min-h-screen bg-white text-black font-neue">
      <header className="fixed top-0 z-10 w-full bg-white">
        <div className="flex h-[50px] items-center px-1 md:h-[70px] md:max-w-6xl md:mx-auto">
          <div className="px-4">
            <Logo color="black" onlyText={true} className="h-[30px] w-[120px] md:h-[50px] md:w-[150px]" tagline={false} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pb-12 pt-24 md:pt-28">
        <div className="mb-8">
          <p className="font-neue text-[10px] font-semibold uppercase tracking-[0.32em] text-neutral-500">
            A Modo Mio
          </p>
          <h1 className="font-neue mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
            Receba o cardápio no WhatsApp
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Envie seu telefone e nome para receber o link do nosso cardápio.
          </p>
        </div>

        <Form method="post" className="flex w-full flex-col gap-6">
          <input type="hidden" name="qr_id" value={qrId} />
          <div className="grid gap-2">
            <Label htmlFor="phone" className="font-neue text-sm text-neutral-600">
              Telefone
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={phoneInput}
              onChange={(event) => setPhoneInput(formatPhoneBR(event.target.value))}
              className="h-16 rounded-xl border-neutral-300 bg-white text-xl text-neutral-900 placeholder:text-neutral-400 md:h-20 md:text-2xl"
              aria-invalid={actionData?.ok === false && actionData.field === "phone"}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name" className="font-neue text-sm text-neutral-600">
              Nome
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Seu nome"
              className="h-16 rounded-xl border-neutral-300 bg-white text-xl text-neutral-900 placeholder:text-neutral-400 md:h-20 md:text-2xl"
              aria-invalid={actionData?.ok === false && actionData.field === "name"}
            />
          </div>

          <Button
            type="submit"
            className="font-neue h-16 rounded-xl bg-black text-xl font-semibold text-white hover:bg-neutral-800 md:h-20 md:text-2xl"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Receber link"}
          </Button>
        </Form>

        {status ? (
          <div
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              status.tone === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {status.text}
          </div>
        ) : null}

        <div className="mt-8 text-center text-xs text-neutral-500">
          Ao continuar, você concorda em receber nosso link via WhatsApp.
        </div>
      </div>
    </div>
  );
}
