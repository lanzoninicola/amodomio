import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const channel = String(url.searchParams.get("channel") || "cardapio")
    .trim()
    .toLowerCase();

  return redirect(
    `/admin/vendas/itens-vendidos/${channel || "cardapio"}/ordenar`
  );
}
