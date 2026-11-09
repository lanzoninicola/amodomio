import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { todayLocalYMD } from "~/domain/kds";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayLocalYMD();

  return redirect(`/admin/mobile/estoque-massa/${date}`);
}
