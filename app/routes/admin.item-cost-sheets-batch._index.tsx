import { redirect } from "@remix-run/node";

export async function loader() {
  return redirect("/admin/item-cost-sheets-batch/adicionar");
}
