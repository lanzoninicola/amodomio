import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { NavLink, Outlet, Link, useLoaderData, useLocation } from "@remix-run/react";
import { cn } from "@/lib/utils";
import prisma from "~/lib/prisma/client.server";

type LoaderData = {
  customer: {
    id: string;
    name: string;
    phone_e164: string;
    tags: { id: string; tag: { key: string; label: string | null } }[];
  };
};

export async function loader({ params }: LoaderFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) throw new Response("not found", { status: 404 });

  const customer = await prisma.crmCustomer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone_e164: true,
      tags: {
        include: { tag: true },
      },
    },
  });

  if (!customer) throw new Response("not found", { status: 404 });

  return json<LoaderData>({ customer });
}

export const meta: MetaFunction = ({ data }) => {
  const name = data?.customer?.name ? ` - ${data.customer.name}` : "";
  return [{ title: `CRM - Cliente${name}` }];
};

const tabs = [
  { href: (id: string) => `/admin/crm/${id}/profile`, label: "Dados" },
  { href: (id: string) => `/admin/crm/${id}/timeline`, label: "Timeline" },
  { href: (id: string) => `/admin/crm/${id}/tags`, label: "Tags" },
  { href: (id: string) => `/admin/crm/${id}/sends`, label: "Envios" },
];

export default function AdminCrmCustomerLayout() {
  const { customer } = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <div className="grid gap-6 font-neue">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <h2 className="text-2xl font-semibold leading-tight">{customer.name}</h2>
          <p className="font-mono text-sm text-muted-foreground">{customer.phone_e164}</p>
          {customer.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {customer.tags.map((t: any) => (
                <form
                  key={t.id}
                  method="post"
                  action={`/admin/crm/${customer.id}/tags`}
                  className="group relative inline-flex"
                >
                  <input type="hidden" name="_intent" value="remove_tag" />
                  <input type="hidden" name="tag_link_id" value={t.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs transition hover:bg-muted/70"
                    title="Remover tag"
                  >
                    {t.tag.label || t.tag.key}
                    <span className="ml-1 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100">
                      ×
                    </span>
                  </button>
                </form>
              ))}
            </div>
          ) : null}
        </div>
        <Link to="/admin/crm" className="text-primary underline text-sm">
          Voltar
        </Link>
      </div>

      <div className="flex gap-4 border-b border-border text-sm">
        {tabs.map((tab) => {
          const href = tab.href(customer.id);
          const isActive = location.pathname === href;
          return (
            <NavLink
              key={href}
              to={href}
              prefetch="intent"
              className={cn(
                "border-b-2 pb-2 transition",
                isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet context={{ customer }} />
    </div>
  );
}
