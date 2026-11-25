import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ call: 0, data: {} as any, actionError: undefined as string | undefined }));
vi.mock("@remix-run/react", () => ({
  useFetcher: () => {
    const call = state.call++;
    return {
      state: "idle", load: () => {},
      data: call === 0 ? state.data : call === 1 && state.actionError ? { ok: false, error: state.actionError } : undefined,
      Form: ({ children, ...props }: any) => createElement("form", props, children),
    };
  },
}));
vi.mock("~/components/ui/button", () => ({ Button: ({ children, size, variant, ...props }: any) => createElement("button", props, children) }));
import { SuitableInboxPanel } from "./suitable-inbox-panel";
beforeEach(() => {
  state.call = 0;
  state.actionError = undefined;
  state.data = { paused: false, status: { configured: true, errorCount: 1 }, orders: [{
    id: "inbox", suitableOrderId: 1902, displayNumber: "1", paid: false,
    receivedAt: "2026-11-24T21:00:00Z", fill: null, fetchError: "[Suitable timeout] etapa=auth",
  }] };
});
it("shows visible number and recovery guidance without fabricated customer or payment data", () => {
  const html = renderToStaticMarkup(createElement(SuitableInboxPanel));
  expect(html).toContain("#1");
  expect(html).not.toContain("#1902");
  expect(html).not.toContain("cliente sem nome");
  expect(html).not.toContain("pagar na entrega/retirada");
  expect(html).toContain("Não foi possível carregar o pedido");
  expect(html).toContain("Tentar de novo");
  expect(html).toContain("Ver diagnóstico técnico");
  expect(html).toContain("[Suitable timeout] etapa=auth");
});
it("presents action failures in an accessible alert", () => {
  state.actionError = "Comanda #1 já está preenchida.";
  const html = renderToStaticMarkup(createElement(SuitableInboxPanel));
  expect(html).toContain('role="alert"');
  expect(html).toContain("A ação não foi concluída");
  expect(html).toContain(state.actionError);
});
