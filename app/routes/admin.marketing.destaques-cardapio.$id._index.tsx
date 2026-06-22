import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(
    `/admin/marketing/destaques-cardapio/${String(params.id || "")}/conteudo`
  );
}
