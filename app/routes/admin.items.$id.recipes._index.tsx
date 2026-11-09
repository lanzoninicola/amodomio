import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return redirect(`${url.pathname.replace(/\/$/, "")}/vinculada`);
}
