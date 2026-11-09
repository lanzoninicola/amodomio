import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function loader({}: LoaderFunctionArgs) {
  throw redirect("/admin/marketing/publicacoes");
}

export default function LegacyDestaquesCardapioRedirect() {
  return null;
}
