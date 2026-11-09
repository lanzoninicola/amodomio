import { authenticator } from "~/domain/auth/google.server";
import { defer, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import prisma from "~/lib/prisma/client.server";
import { getCustomerPurchaseHistory } from "~/domain/crm/order-history.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) throw redirect("/login");
  if (!params.customerId)
    throw new Response("Cliente não encontrado", { status: 404 });
  const customer = await prisma.crmCustomer.findUnique({
    where: { id: params.customerId },
    select: { id: true, phone_e164: true },
  });
  if (!customer) throw new Response("Cliente não encontrado", { status: 404 });
  return defer({
    history: getCustomerPurchaseHistory(customer.id, customer.phone_e164),
  });
}
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";
export default function CustomerOrders() {
  const { history } = useLoaderData<typeof loader>();
  return (
    <Suspense fallback={<p role="status">Carregando compras e sabores…</p>}>
      <Await
        resolve={history}
        errorElement={
          <p role="alert">Não foi possível carregar o histórico de compras.</p>
        }
      >
        {({ summary, orders, totalHistory }) => (
          <div className="grid gap-6">
            <div>
              <h3 className="text-lg font-semibold">Compras e sabores</h3>
              <p className="text-sm text-muted-foreground">
                Métricas dos pedidos registrados neste histórico. Os totais
                importados do ERP permanecem na aba Dados. Pedidos cancelados
                não entram nas estatísticas.
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Pedidos", summary.orders],
                ["Receita", money(summary.revenue)],
                ["Ticket médio", money(summary.average)],
                ["Primeira compra", date(summary.first)],
                ["Última compra", date(summary.last)],
              ].map(([label, value]) => (
                <div className="rounded-lg border p-3" key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <section className="grid gap-2">
              <h4 className="font-semibold">Sabores mais pedidos</h4>
              <p className="text-sm text-muted-foreground">
                Cada pizza conta uma ocorrência de cada sabor escolhido. Uma
                pizza com dois sabores continua sendo uma pizza. Itens do CSV
                sem sabores informados não entram neste ranking.
              </p>
              {summary.flavors.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Sabor</th>
                        <th className="p-2">Ocorrências em pizzas</th>
                        <th className="p-2">Pedidos com o sabor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.flavors.map((flavor) => (
                        <tr key={flavor.name} className="border-t">
                          <td className="p-2">{flavor.name}</td>
                          <td className="p-2">{flavor.occurrences}</td>
                          <td className="p-2">{flavor.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum sabor registrado.
                </p>
              )}
            </section>
            <section className="grid gap-3">
              <h4 className="font-semibold">Histórico de compras</h4>
              {totalHistory > 50 && (
                <p className="text-sm text-muted-foreground">
                  Exibindo os 50 pedidos mais recentes de {totalHistory}. As
                  estatísticas consideram todo o histórico.
                </p>
              )}
              {!orders.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma compra registrada.
                </p>
              )}
              {orders.map((order) => (
                <article key={order.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-medium">
                      {date(order.date)} ·{" "}
                      {order.source === "suitable-kds"
                        ? `Comanda ${order.number}`
                        : `Pedido ${order.number}`}
                    </p>
                    <p>
                      {money(order.total)}
                      {!order.active && " · Cancelado/inativo"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Origem: {order.source}
                  </p>
                  <ul className="mt-2 grid gap-2">
                    {order.items.map((item, index) => (
                      <li key={index} className="text-sm">
                        <p>
                          {item.quantity} × {item.name}
                          {item.size ? ` · ${item.size}` : ""}
                        </p>
                        {item.flavors.length > 0 && (
                          <p className="text-muted-foreground">
                            Sabores: {item.flavors.join(" / ")}
                          </p>
                        )}
                        {item.notes.length > 0 && (
                          <p className="text-muted-foreground">
                            Observações: {item.notes.join("; ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          </div>
        )}
      </Await>
    </Suspense>
  );
}
