import { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/react";


export async function loader({ request }: LoaderFunctionArgs) {

  return redirect("/admin/gerenciamento/dna?redirectFrom=admin/gerenciamento/cardapio/sell-price-management")
}