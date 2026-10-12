import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReconnectionResult } from "~/domain/z-api/reconnection.server";

const ACTION_URL = "/admin/zapi/envios";

export function ZapiReconnectionControls() {
  const reconnect = useFetcher<ReconnectionResult>();
  const connection = useFetcher<ReconnectionResult>();
  const [expired, setExpired] = useState(false);
  const result = reconnect.data;
  const latest =
    (connection.data?.checkedAt || 0) > (result?.checkedAt || 0)
      ? connection.data
      : result;
  const connected = latest?.state === "connected";
  const busy = reconnect.state !== "idle";
  const qr = result?.state === "qr" && !connected ? result : null;
  const submit = connection.submit;
  const checking = connection.state !== "idle";

  useEffect(() => {
    setExpired(false);
    if (!qr) return;
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, qr.expiresAt - Date.now())
    );
    return () => clearTimeout(timer);
  }, [qr]);

  useEffect(() => {
    if (!qr || expired || busy || checking) return;
    const timer = setTimeout(
      () =>
        submit(
          { _intent: "connection" },
          { method: "post", action: ACTION_URL }
        ),
      3_000
    );
    return () => clearTimeout(timer);
  }, [qr, expired, busy, checking, connection.data, submit]);

  return (
    <div className="space-y-3 rounded border p-4">
      <div className="flex flex-wrap gap-2">
        <reconnect.Form method="post" action={ACTION_URL}>
          <Button
            type="submit"
            name="_intent"
            value="reconnect"
            disabled={busy || checking}
          >
            {busy ? "Verificando e reconectando…" : "Tentar reconectar"}
          </Button>
        </reconnect.Form>
        <connection.Form method="post" action={ACTION_URL}>
          <Button
            type="submit"
            variant="outline"
            name="_intent"
            value="connection"
            disabled={busy || checking}
          >
            {checking ? "Verificando…" : "Verificar conexão"}
          </Button>
        </connection.Form>
        {!connected ? (
          <reconnect.Form method="post" action={ACTION_URL}>
            <Button
              type="submit"
              variant="outline"
              name="_intent"
              value="qr-code"
              disabled={busy || checking}
            >
              {qr ? "Gerar novo QR Code" : "Mostrar QR Code"}
            </Button>
          </reconnect.Form>
        ) : null}
      </div>
      {busy ? (
        <p role="status" className="text-sm">
          Aguarde a verificação da sessão do WhatsApp.
        </p>
      ) : null}
      {connected ? (
        <p role="status" className="text-sm font-medium text-emerald-700">
          WhatsApp conectado. Os envios estão disponíveis.
        </p>
      ) : null}
      {!busy && !connected && latest ? (
        <p
          role={latest.state === "error" ? "alert" : "status"}
          className="text-sm"
        >
          {latest.message}
        </p>
      ) : null}
      {qr && !busy ? (
        <div className="space-y-3">
          <p className="text-sm">
            No celular, abra WhatsApp → Aparelhos conectados → Conectar um
            aparelho e leia o código.
          </p>
          {expired ? (
            <p role="status" className="text-sm text-amber-700">
              QR Code expirado. Gere um novo para continuar.
            </p>
          ) : (
            <img
              src={qr.qrCode}
              alt="QR Code para conectar o WhatsApp à Z-API"
              width={256}
              height={256}
              className="max-w-full rounded bg-white p-2"
            />
          )}
          {!expired ? (
            <p className="text-xs text-muted-foreground">
              O código expira em até 20 segundos. A conexão será verificada
              durante esse período.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
