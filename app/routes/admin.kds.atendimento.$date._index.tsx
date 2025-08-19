import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const date = params.date!;
  return redirect(`/admin/kds/atendimento/${date}/grid`);
}
