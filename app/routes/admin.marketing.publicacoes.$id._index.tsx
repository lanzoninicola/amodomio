import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  throw redirect(
    `/admin/marketing/publicacoes/${String(params.id || "")}/conteudo`
  );
}

export default function ContentPostIndexRedirect() {
  return null;
}
