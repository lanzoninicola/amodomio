import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/admin/recipes/${params.id}/procedimento/preview`);
}
