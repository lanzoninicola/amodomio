import { redirect } from "@remix-run/node";

export async function loader({ params }: { params: { customerId?: string } }) {
  const id = params.customerId;
  if (!id) throw new Response("not found", { status: 404 });
  return redirect(`/admin/crm/${id}/profile`);
}
