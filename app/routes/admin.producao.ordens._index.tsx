import { defer, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { authenticator } from "~/domain/auth/google.server";
import {
  OrderStatusBadge,
  Quantity,
  ORDER_STATUS_STYLE,
} from "~/domain/production/components/production-ui";
import type { listProductionOrders as ListFn } from "~/domain/production/production-order.server";
import { listProductionOrders } from "~/domain/production/production-order.server";
import { cn } from "~/lib/utils";


export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const status = new URL(request.url).searchParams.get("status") || undefined;
  return defer({ orders: listProductionOrders(status) });
}

const FILTERS = [
  { value: "", label: "Todas" },
  ...Object.entries(ORDER_STATUS_STYLE).map(([value, s]) => ({ value, label: s.label })),
];

export default function ProductionOrdersIndex() {
  const { orders } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const active = params.get("status") || "";

  return (
    <div className="w-full space-y-6 p-4 md:p-6 2xl:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold 2xl:text-4xl">Produção</h1>
        <Button asChild size="lg" className="h-16 px-8 text-xl">
          <Link to="/admin/producao/ordens/new">
            <Plus className="mr-2 h-6 w-6" /> Nova produção
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            asChild
            variant={active === f.value ? "default" : "outline"}
            className="h-14 px-6 text-lg"
          >
            <Link to={f.value ? `?status=${f.value}` : "."}>{f.label}</Link>
          </Button>
        ))}
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        }
      >
        <Await resolve={orders as unknown as Promise<Awaited<ReturnType<typeof ListFn>>>} errorElement={<p className="text-destructive">Erro ao carregar as OPs.</p>}>
          {(list: Awaited<ReturnType<typeof ListFn>>) =>
            list.length === 0 ? (
              <p className="py-16 text-center text-xl text-muted-foreground">
                Nenhuma produção por aqui ainda.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {list.map((order) => {
                  const done = order.Steps.filter((s) => s.status === "done").length;
                  return (
                    <Link key={order.id} to={`/admin/producao/ordens/${order.id}`} className="block">
                      <Card
                        className={cn(
                          "h-full space-y-4 p-6 transition active:scale-[0.99] hover:shadow-md",
                          order.status === "in_progress" && "border-amber-400 border-2"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-2xl font-bold text-muted-foreground">
                            OP #{order.number}
                          </span>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <h2 className="text-3xl font-bold leading-tight">{order.recipeName}</h2>
                        <div className="rounded-lg bg-muted px-4 py-3">
                          <div className="text-sm text-muted-foreground">
                            Ingrediente principal · {order.baseIngredient}
                          </div>
                          <Quantity
                            quantity={order.baseQuantity}
                            unit={order.baseUnit}
                            className="text-4xl"
                          />
                        </div>
                        <div className="flex items-center justify-between text-lg text-muted-foreground">
                          <span>
                            Produzir: {format(order.productionDate, "dd/MM/yyyy")}
                            {order.usageDate && format(order.usageDate, "dd/MM/yyyy") !== format(order.productionDate, "dd/MM/yyyy") && (
                              <> · Usar: {format(order.usageDate, "dd/MM/yyyy")}</>
                            )}
                          </span>
                          <span>
                            {done}/{order.Steps.length} etapas
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )
          }
        </Await>
      </Suspense>
    </div>
  );
}
