import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ call: 0, data: {} as any, actionError: undefined as string | undefined }));
vi.mock("@remix-run/react", () => ({
  useRevalidator: () => ({ revalidate: () => {} }),
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
import { SuitableInboxPanel, SuitableIntegrationProvider, SuitableIntegrationToolbar } from "./suitable-inbox-panel";
beforeEach(() => {
  state.call = 0;
  state.actionError = undefined;
  state.data = { paused: false, status: { configured: true, errorCount: 1 }, orders: [{
    id: "inbox", suitableOrderId: 1902, displayNumber: "1", paid: false,
    receivedAt: "2026-11-24T21:00:00Z", fill: null, fetchError: "[Suitable timeout] etapa=auth",
  }] };
});
it("shows visible number and recovery guidance without fabricated customer or payment data", () => {
  const html = renderToStaticMarkup(createElement(SuitableIntegrationProvider, { children: createElement(SuitableInboxPanel) }));
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
  const html = renderToStaticMarkup(createElement(SuitableIntegrationProvider, { children: createElement(SuitableInboxPanel) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain("A ação não foi concluída");
  expect(html).toContain(state.actionError);
});

it("requires no launch action for a healthy queued order", () => {
  state.data.status.errorCount = 0;
  state.data.orders[0].fetchError = null;
  state.data.orders[0].fill = { customerName: "Cliente", orderAmount: 100, unmappedItems: [], takeAway: false, hasMoto: true };
  const html = renderToStaticMarkup(createElement(SuitableIntegrationProvider, { children: createElement(SuitableInboxPanel) }));
  expect(html).toContain("lançados automaticamente");
  expect(html).not.toContain("Lançar na comanda");
});

it("hides incoming orders while paused and keeps resume and status in the toolbar", () => {
  state.data.paused = true;
  const html = renderToStaticMarkup(createElement(SuitableIntegrationProvider, { children: [
    createElement(SuitableIntegrationToolbar, { key: "toolbar" }), createElement(SuitableInboxPanel, { key: "panel" }),
  ] }));
  expect(html).toContain("Retomar integração Suitable");
  expect(html).toContain("Suitable · Pausada");
  expect(html).not.toContain("Pedido #1");
  expect(html).not.toContain("Ver diagnóstico técnico");
  expect(html).not.toContain("aguardando recuperação");
});
