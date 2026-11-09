import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({}: LoaderFunctionArgs) {
  return redirect("/admin/vendas/analise-cardapio-concorrencia/pesquisar/resultados");
}
