import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";

type InboxOrder = {
  id: string;
  suitableOrderId: number;
  displayNumber: string | null;
  paid: boolean;
  fetchError: string | null;
  fill: {
    customerName: string;
    orderAmount: number;
    unmappedItems: string[];
    takeAway: boolean;
    hasMoto: boolean;
  } | null;
};

export function SuitableInboxPanel({ readOnly }: { readOnly?: boolean }) {
  const list = useFetcher<{ orders: InboxOrder[] }>();
  const act = useFetcher<{ ok: boolean; error?: string }>();
  useEffect(() => {
    list.load("/api/suitable/inbox");
    const t = setInterval(() => list.load("/api/suitable/inbox"), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (act.state === "idle" && act.data) list.load("/api/suitable/inbox");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act.state]);

  const orders = list.data?.orders ?? [];
  if (!orders.length) return null;
  return (
    <div className="border rounded-md bg-amber-50 p-2 mb-2 text-sm">
      <div className="font-semibold mb-1">
        Pedidos Suitable pendentes ({orders.length})
      </div>
      {act.data?.ok === false && (
        <div className="text-red-600 mb-1">{act.data.error}</div>
      )}
      <ul className="flex flex-col gap-1">
        {orders.map((o) => (
          <li key={o.id} className="flex items-center gap-2 flex-wrap">
            <span>
              #{o.displayNumber ?? o.suitableOrderId} ·{" "}
              {o.fill?.customerName || "sem nome"} · R${" "}
              {o.fill?.orderAmount.toFixed(2) ?? "—"}
              {o.fill?.takeAway ? " · retirada" : o.fill?.hasMoto ? " · entrega" : ""}
              {!o.paid && " · não pago"}
            </span>
            {o.fill?.unmappedItems.length ? (
              <span className="text-red-600">
                tamanho não detectado: {o.fill.unmappedItems.join(", ")}
              </span>
            ) : null}
            {o.fetchError && <span className="text-red-600">{o.fetchError}</span>}
            {!readOnly && (
              <act.Form method="post" className="flex gap-1">
                <input type="hidden" name="inboxId" value={o.id} />
                <Button
                  size="sm"
                  type="submit"
                  name="_action"
                  value="importSuitable"
                  disabled={!o.fill || act.state !== "idle"}
                >
                  Preencher
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="submit"
                  name="_action"
                  value="dismissSuitable"
                >
                  Descartar
                </Button>
              </act.Form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
