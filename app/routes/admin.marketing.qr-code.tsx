import type { MetaFunction } from "@remix-run/node";
import { Download, ExternalLink, QrCode, RotateCcw } from "lucide-react";
import * as React from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export const meta: MetaFunction = () => [
  { title: "Gerador de QR Code | Marketing" },
];

const DEFAULT_SIZE = 720;
const DEFAULT_FOREGROUND = "#111827";
const DEFAULT_BACKGROUND = "#ffffff";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  const host = (() => {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return "conteudo";
    }
  })();

  return `qr-code-${host.replace(/[^a-z0-9.-]+/gi, "-")}`;
}

export default function AdminMarketingQrCodePage() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [content, setContent] = React.useState("");
  const [size, setSize] = React.useState(DEFAULT_SIZE);
  const [foreground, setForeground] = React.useState(DEFAULT_FOREGROUND);
  const [background, setBackground] = React.useState(DEFAULT_BACKGROUND);
  const [svg, setSvg] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setContent(`${window.location.origin}/cardapio`);
  }, []);

  React.useEffect(() => {
    if (!content.trim() || !canvasRef.current) {
      setSvg("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const QRCode = await import("qrcode");
        const options = {
          errorCorrectionLevel: "H" as const,
          margin: 3,
          width: size,
          color: { dark: foreground, light: background },
        };

        await QRCode.toCanvas(canvasRef.current, content.trim(), options);
        const nextSvg = await QRCode.toString(content.trim(), {
          ...options,
          type: "svg",
        });

        if (!cancelled) {
          setSvg(nextSvg);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setSvg("");
          setError(
            "Não foi possível gerar o QR Code. Reduza o conteúdo e tente novamente."
          );
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [background, content, foreground, size]);

  function useCardapioLink() {
    setContent(`${window.location.origin}/cardapio`);
  }

  function resetAppearance() {
    setSize(DEFAULT_SIZE);
    setForeground(DEFAULT_FOREGROUND);
    setBackground(DEFAULT_BACKGROUND);
  }

  function downloadPng() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${safeFilename(content)}.png`);
    }, "image/png");
  }

  function downloadSvg() {
    if (!svg) return;
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${safeFilename(content)}.svg`
    );
  }

  const canDownload = Boolean(content.trim() && svg && !error);
  const isLink = /^https?:\/\//i.test(content.trim());

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <QrCode className="h-6 w-6 text-slate-700" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Gerador de QR Code
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Crie um QR Code para links, textos ou mensagens e baixe a arte pronta
          para impressão.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-7">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="qr-content">Conteúdo do QR Code</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useCardapioLink}
              >
                Usar link do Cardápio
              </Button>
            </div>
            <Textarea
              id="qr-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="https://www.amodomio.com.br/cardapio"
              rows={5}
              className="resize-y text-base"
              autoFocus
            />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>O conteúdo é processado somente neste navegador.</span>
              <span>{content.length} caracteres</span>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">Aparência e arquivo</h2>
                <p className="text-sm text-muted-foreground">
                  Use alto contraste para facilitar a leitura.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAppearance}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="qr-size">Tamanho (px)</Label>
                <Input
                  id="qr-size"
                  type="number"
                  min={256}
                  max={2048}
                  step={64}
                  value={size}
                  onChange={(event) =>
                    setSize(
                      Math.min(
                        2048,
                        Math.max(256, Number(event.target.value) || 256)
                      )
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr-foreground">Cor do código</Label>
                <div className="flex gap-2">
                  <Input
                    id="qr-foreground"
                    type="color"
                    value={foreground}
                    onChange={(event) => setForeground(event.target.value)}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={foreground}
                    onChange={(event) => setForeground(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qr-background">Cor do fundo</Label>
                <div className="flex gap-2">
                  <Input
                    id="qr-background"
                    type="color"
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border bg-slate-50 p-5">
          <div className="mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-xl border bg-white p-3 shadow-sm">
            {content.trim() ? (
              <canvas
                ref={canvasRef}
                className="h-full w-full"
                aria-label="Prévia do QR Code"
              />
            ) : (
              <div className="px-6 text-center text-sm text-muted-foreground">
                Digite um conteúdo para gerar a prévia.
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={downloadPng} disabled={!canDownload}>
              <Download className="mr-2 h-4 w-4" />
              PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={downloadSvg}
              disabled={!canDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              SVG
            </Button>
          </div>

          {isLink ? (
            <Button type="button" variant="ghost" className="w-full" asChild>
              <a href={content.trim()} target="_blank" rel="noreferrer">
                Testar destino
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground">
            PNG é indicado para redes sociais. SVG mantém a nitidez em placas,
            adesivos e materiais impressos.
          </p>
        </aside>
      </div>
    </main>
  );
}
