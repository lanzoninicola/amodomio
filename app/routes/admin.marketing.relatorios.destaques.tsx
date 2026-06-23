import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  throw redirect(`/admin/marketing/relatorios/cardapio-featured${url.search}`);
}

export default function LegacyCardapioFeaturedReportRedirect() {
  return null;
}
