import { useEffect, useRef, useState } from "react";
import { useFetcher } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";

type ApiResult<T = any> = { ok: boolean; status: number; data?: T; error?: string };

export default function WppPage() {
  // estados UI
  const [session, setSession] = useState("amodomio"); // mude se quiser
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("desconhecido");
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const fetcher = useFetcher<ApiResult>();
  const pollRef = useRef<number | null>(null);

  // helpers de chamada
  const call = (op: "start" | "status" | "qr" | "send", payload: Record<string, string>) => {
    const fd = new FormData();
    fd.set("op", op);
    Object.entries(payload).forEach(([k, v]) => fd.set(k, v));
    fetcher.submit(fd, { method: "post", action: "/api/wpp" });
  };

  // polling de status + qr
  useEffect(() => {
    if (!session) return;
    // limpa polling anterior
    if (pollRef.current) window.clearInterval(pollRef.current);

    // dispara 1x
    call("status", { session });
    call("qr", { session });

    // revalida a cada 3s
    pollRef.current = window.setInterval(() => {
      call("status", { session });
      call("qr", { session });
    }, 3000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [session]);

  // trata respostas
  useEffect(() => {
    if (fetcher.data) {
      const d = fetcher.data;
      // heurísticas simples (ajuste conforme seu server)
      if (typeof d?.data === "object" && d.data) {
        // status
        if ("state" in d.data || "status" in d.data || "connected" in d.data) {
          const st = (d.data.state ?? d.data.status ?? "").toString().toLowerCase();
          const conn = Boolean(d.data.connected ?? (st.includes("connected") || st.includes("inchat")));
          setStatusText(st || (conn ? "connected" : "disconnected"));
          setIsConnected(conn);
        }
        // qr
        if ("base64" in d.data || "qr" in d.data) {
          const base64 = (d.data.base64 ?? d.data.qr) as string | undefined;
          if (base64 && base64.startsWith("data:image")) setQrBase64(base64);
          else if (base64 && !base64.startsWith("data:image")) setQrBase64(`data:image/png;base64,${base64}`);
        }
      }
      if (!d.ok && d.error) {
        console.warn("Erro API:", d.error);
      }
    }
  }, [fetcher.data]);

  // envio de mensagem
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Ciao! Messaggio di test dal A Modo Mio 🍕");
  const [sendResult, setSendResult] = useState<string | null>(null);

  const onSend = async () => {
    setSendResult(null);
    const fd = new FormData();
    fd.set("op", "send");
    fd.set("session", session);
    fd.set("phone", phone.trim());
    fd.set("message", message);
    const res = await fetch("/api/wpp", { method: "POST", body: fd });
    const data = await res.json();
    setSendResult(data?.ok ? "Mensagem enviada com sucesso." : `Falhou: ${data?.error || res.status}`);
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-8">
      <h1 className="text-2xl font-semibold">WPPConnect • Demo de Conexão e Envio</h1>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>1) Conectar WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <Label htmlFor="session">Nome da sessão</Label>
              <Input id="session" value={session} onChange={(e) => setSession(e.target.value)} placeholder="amodomio" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => call("start", { session })}>Iniciar sessão</Button>
              <Button variant="outline" onClick={() => call("status", { session })}>Checar status</Button>
              <Button variant="outline" onClick={() => call("qr", { session })}>Atualizar QR</Button>
            </div>
            <div className="text-sm opacity-80">
              Status: <span className={isConnected ? "text-green-600" : "text-red-600"}>{statusText}</span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm mb-2">Escaneie o QR no WhatsApp</div>
              <div className="w-full aspect-square border rounded-xl flex items-center justify-center overflow-hidden bg-white">
                {qrBase64 ? (
                  <img alt="QR Code" src={qrBase64} className="w-full h-full object-contain" />
                ) : (
                  <div className="text-sm opacity-60 p-4 text-center">
                    QR não disponível ainda. Clique em “Iniciar sessão” e aguarde o polling.
                  </div>
                )}
              </div>
            </div>

            <Alert>
              <AlertTitle className="font-medium">Dicas</AlertTitle>
              <ul className="list-disc ml-5 mt-2 text-sm">
                <li>Abra o WhatsApp → Aparelhos Conectados → Conectar um aparelho → aponte para o QR.</li>
                <li>Se o QR expirar, clique em <b>Atualizar QR</b>.</li>
                <li>Conectado? O status deve ficar algo como <i>connected</i> / <i>inChat</i>.</li>
              </ul>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>2) Enviar mensagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Número (WhatsApp)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5546999999999" />
            </div>
            <div>
              <Label htmlFor="message">Mensagem</Label>
              <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={!isConnected} onClick={onSend}>Enviar</Button>
            {!isConnected && <span className="text-sm text-amber-600">Conecte a sessão primeiro.</span>}
          </div>
          {sendResult && (
            <Alert>
              <AlertTitle>{sendResult}</AlertTitle>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
