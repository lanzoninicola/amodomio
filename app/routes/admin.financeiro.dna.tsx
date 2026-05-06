import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectFrom = url.searchParams.get("redirectFrom");
  const nextUrl = new URL("/admin/vendas/dna", url.origin);
  if (redirectFrom) nextUrl.searchParams.set("redirectFrom", redirectFrom);
  return redirect(`${nextUrl.pathname}${nextUrl.search}`);
}
