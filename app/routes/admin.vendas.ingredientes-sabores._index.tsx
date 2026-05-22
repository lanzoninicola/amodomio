import { redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Vendas | Ingredientes por sabores" },
];

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return redirect(`/admin/vendas/ingredientes-sabores/lista${url.search}`);
}
