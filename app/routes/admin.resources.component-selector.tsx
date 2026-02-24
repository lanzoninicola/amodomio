import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export async function loader(_: LoaderFunctionArgs) {
  return json({ products: [] });
}

export function ComponentSelector() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
      Composição por `Product` foi removida. Use `Recipe`/`ItemCostSheet`.
    </div>
  );
}
