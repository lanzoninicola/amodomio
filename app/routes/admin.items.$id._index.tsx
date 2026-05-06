import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.id) return redirect("/admin/items");
  return redirect(`/admin/items/${params.id}/main`);
}

