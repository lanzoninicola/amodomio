import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { lastUrlSegment } from "~/utils/url";

const WELL_KNOWN_PATH_PREFIX = ".well-known/";

export function loader({ request, params }: LoaderFunctionArgs) {
  const splat = params["*"] ?? "";

  const last = lastUrlSegment(request.url);

  // Chrome DevTools probes this path whenever a page is opened. Redirecting
  // the probe to /cardapio makes Chrome repeat the navigation indefinitely.
  if (splat.startsWith(WELL_KNOWN_PATH_PREFIX)) {
    return new Response(null, { status: 404 });
  }

  // Fixing typo URL error
  if (last === "cardapio.") {
    return redirect("cardapio");
  }

  if (splat === "admin/cardapio") {
    return redirect("/admin/gerenciamento/cardapio");
  }

  return redirect("/cardapio");
}
