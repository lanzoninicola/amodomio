import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const destination = new URL(
    "/admin/gerenciamento/cardapio/dashboard/tracking",
    url.origin
  );

  destination.search = url.search;

  return redirect(destination.toString());
}

