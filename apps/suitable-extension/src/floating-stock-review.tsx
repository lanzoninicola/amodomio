import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  StockBatchReview,
  type StockBatchView,
  type StockRequest,
} from "~/components/admin/stock-batch-review";
import type { PurchaseNote } from "./stock-parser";

export function FloatingStockReview({
  view,
  note,
  request,
  portalContainer,
  hidden,
  onClose,
}: {
  view: StockBatchView;
  note: PurchaseNote | null;
  request: StockRequest;
  portalContainer: HTMLElement;
  hidden: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(
    null
  );
  const [position, setPosition] = useState({
    x: Math.max(
      8,
      window.innerWidth - Math.min(640, window.innerWidth - 16) - 24
    ),
    y: 64,
  });
  function constrain(x: number, y: number) {
    return {
      x: Math.max(
        8,
        Math.min(
          x,
          window.innerWidth -
            (panel.current?.offsetWidth ||
              Math.min(640, window.innerWidth - 16)) -
            8
        )
      ),
      y: Math.max(
        8,
        Math.min(
          y,
          window.innerHeight - (panel.current?.offsetHeight || 64) - 8
        )
      ),
    };
  }
  useEffect(() => {
    const resize = () =>
      setPosition((current) => constrain(current.x, current.y));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [hidden]);
  return createPortal(
    <section
      ref={panel}
      id="stock-entry-body"
      role="dialog"
      aria-modal="false"
      aria-labelledby="stock-link-title"
      hidden={hidden}
      className="extension fixed z-[1400] flex w-[640px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border bg-white shadow-xl"
      style={{
        display: hidden ? "none" : "flex",
        left: position.x,
        top: position.y,
        maxHeight: "calc(100vh - 16px)",
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
        <div
          className="flex min-w-0 flex-1 cursor-move select-none items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-stock-drag-handle
          tabIndex={0}
          role="button"
          aria-label="Mover janela de vínculo. Use as setas do teclado para mover."
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            drag.current = {
              pointerId: event.pointerId,
              dx: event.clientX - position.x,
              dy: event.clientY - position.y,
            };
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {}
            event.currentTarget.focus();
          }}
          onPointerMove={(event) => {
            if (drag.current?.pointerId === event.pointerId)
              setPosition(
                constrain(
                  event.clientX - drag.current.dx,
                  event.clientY - drag.current.dy
                )
              );
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId === event.pointerId)
              drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const steps: Record<string, [number, number]> = {
              ArrowLeft: [-20, 0],
              ArrowRight: [20, 0],
              ArrowUp: [0, -20],
              ArrowDown: [0, 20],
            };
            const step = steps[event.key];
            if (!step) return;
            event.preventDefault();
            setPosition((current) =>
              constrain(current.x + step[0], current.y + step[1])
            );
          }}
        >
          <GripHorizontal
            className="h-5 w-5 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 id="stock-link-title" className="font-semibold text-slate-900">
              Vincular produtos ao estoque
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {note
                ? `NF ${note.invoiceNumber} · ${note.supplierName}`
                : "Arraste pelo cabeçalho"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar vínculo de produtos"
          title="Fechar e consultar o Suitable"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>
      <div className="min-h-0 overflow-auto p-4">
        <StockBatchReview
          initial={view}
          request={request}
          portalContainer={portalContainer}
          portalZIndex={1500}
        />
      </div>
    </section>,
    portalContainer
  );
}
