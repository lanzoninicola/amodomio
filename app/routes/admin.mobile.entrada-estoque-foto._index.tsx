import { redirect } from "@remix-run/node";

export function loader() {
  return redirect("/admin/mobile/entrada-estoque-foto/unica");
}
