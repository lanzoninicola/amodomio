import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { buildAiFlavorInnovationExport } from "~/domain/menu-engineering/ai-flavor-innovation-export.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect("/login");

  const payload = await buildAiFlavorInnovationExport();
  const date = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="amodomio-cardapio-para-ia-${date}.json"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
