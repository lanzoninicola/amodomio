import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { PurchaseNote } from "./stock-parser";

const WIDTH = 1080;
const MIN_WIDTH = 480;
const MIN_HEIGHT = 320;
type Edge = "e" | "s" | "se" | "w" | "sw";
const HANDLES: { edge: Edge; className: string; cursor: string }[] = [
  { edge: "e", className: "right-0 top-3 bottom-3 w-2", cursor: "ew-resize" },
  { edge: "w", className: "left-0 top-3 bottom-3 w-2", cursor: "ew-resize" },
  { edge: "s", className: "bottom-0 left-3 right-3 h-2", cursor: "ns-resize" },
  { edge: "se", className: "bottom-0 right-0 h-4 w-4", cursor: "nwse-resize" },
  { edge: "sw", className: "bottom-0 left-0 h-4 w-4", cursor: "nesw-resize" },
];

export function FloatingStockReview({
  embedUrl,
  note,
  portalContainer,
  hidden,
  onClose,
}: {
  embedUrl: string;
  note: PurchaseNote | null;
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
      window.innerWidth - Math.min(WIDTH, window.innerWidth - 16) - 24
    ),
    y: 64,
  });
  const [size, setSize] = useState(() => ({
    w: Math.min(WIDTH, window.innerWidth - 16),
    h: Math.min(820, window.innerHeight - 80),
  }));
  const resize = useRef<{
    pointerId: number;
    edge: Edge;
    x: number;
    y: number;
    left: number;
    w: number;
    h: number;
  } | null>(null);
  function startResize(edge: Edge, event: React.PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resize.current = {
      pointerId: event.pointerId,
      edge,
      x: event.clientX,
      y: event.clientY,
      left: position.x,
      w: panel.current?.offsetWidth || size.w,
      h: panel.current?.offsetHeight || size.h,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {}
  }
  function moveResize(event: React.PointerEvent) {
    const start = resize.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    let w = start.w;
    let h = start.h;
    let x = start.left;
    if (start.edge.includes("e")) w = start.w + dx;
    if (start.edge.includes("w")) {
      w = start.w - dx;
      x = start.left + dx;
    }
    if (start.edge.includes("s")) h = start.h + dy;
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - position.y - 8;
    const nextW = Math.max(MIN_WIDTH, Math.min(w, maxW));
    if (start.edge.includes("w")) x = start.left + start.w - nextW;
    setSize({
      w: nextW,
      h: Math.max(MIN_HEIGHT, Math.min(h, Math.max(MIN_HEIGHT, maxH))),
    });
    setPosition((current) => ({
      ...current,
      x: Math.max(8, Math.min(x, window.innerWidth - nextW - 8)),
    }));
  }
  function endResize(event: React.PointerEvent) {
    if (resize.current?.pointerId === event.pointerId) resize.current = null;
  }
  function constrain(x: number, y: number) {
    return {
      x: Math.max(
        8,
        Math.min(
          x,
          window.innerWidth -
            (panel.current?.offsetWidth ||
              Math.min(WIDTH, window.innerWidth - 16)) -
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
      className="extension fixed z-[1400] flex max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border bg-white shadow-xl"
      style={{
        display: hidden ? "none" : "flex",
        left: position.x,
        top: position.y,
        width: size.w,
        height: size.h,
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
              Importação de estoque
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
      <div className="flex min-h-0 flex-1 bg-white px-5 py-4">
        <iframe
          title="Importação de estoque Amodomio"
          src={embedUrl}
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      </div>
      {HANDLES.map(({ edge, className, cursor }) => (
        <div
          key={edge}
          data-stock-resize={edge}
          aria-hidden="true"
          className={`absolute z-10 ${className}`}
          style={{ cursor, touchAction: "none" }}
          onPointerDown={(event) => startResize(edge, event)}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onLostPointerCapture={endResize}
        />
      ))}
    </section>,
    portalContainer
  );
}
