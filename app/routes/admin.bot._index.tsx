import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useEffect, useState } from "react";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";

import { getSession } from "~/domain/bot/session.server";
import { Button } from "@/components/ui/button"; // shadcn
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthUser } from "~/domain/auth/require-auth-user.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuthUser(request);
  // Defina um sessionKey padrão (ex.: "amodomio")
  const sessionKey = process.env.WPP_DEFAULT_SESSION || "amodomio";
  const session = await getSession(sessionKey).catch(() => null);
  return json({ sessionKey, session });
}

export default function AdminBotIndex() {
  const { sessionKey, session } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [qrcode, setQrcode] = useState<string | null>(session?.qrcode ?? null);

  // Poll do QR code a cada 3s enquanto não conectado
  useEffect(() => {
    const id = setInterval(() => {
      fetcher.load(`/admin/bot/api/wpp/qrcode?sessionKey=${encodeURIComponent(sessionKey)}`);
      fetcher.load(`/admin/bot/api/wpp/status?sessionKey=${encodeURIComponent(sessionKey)}`);
    }, 3000);
    return () => clearInterval(id);
  }, [sessionKey]);

  useEffect(() => {
    if (fetcher.data?.qrcode) {
      setQrcode(fetcher.data.qrcode);
    }
  }, [fetcher.data]);

  return (
    <div className="mx-auto max-w-4xl py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conexão WhatsApp – Sessão <span className="font-mono">{sessionKey}</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Form method="post" action="/admin/bot/api/wpp/connect">
              <input type="hidden" name="sessionKey" value={sessionKey} />
              <Button type="submit">Iniciar / Recarregar Sessão</Button>
            </Form>
            <Form method="post" action="/admin/bot/api/wpp/logout">
              <input type="hidden" name="sessionKey" value={sessionKey} />
              <Button type="submit" variant="secondary">Logout</Button>
            </Form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">QR Code</h3>
              <div className="border rounded-lg p-4 min-h-64 flex items-center justify-center">
                {qrcode ? (
                  // Se vier como dataURL
                  qrcode.startsWith("data:image") ? (
                    <img src={qrcode} alt="QR Code" className="w-64 h-64 object-contain" />
                  ) : (
                    <pre className="text-xs overflow-auto">{qrcode}</pre>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground">Aguardando QR code...</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Enviar mensagem</h3>
              <Form method="post" action="/admin/bot/api/wpp/send" className="space-y-3">
                <input type="hidden" name="sessionKey" value={sessionKey} />
                <Input name="to" placeholder="Número (ex.: 5546999999999)" required />
                <Input name="text" placeholder="Mensagem" required />
                <Button type="submit">Enviar</Button>
              </Form>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
