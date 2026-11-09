import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";

const TARGET = "/admin/items";

export async function loader(_: LoaderFunctionArgs) {
  throw redirect(TARGET);
}

export async function action(_: ActionFunctionArgs) {
  throw redirect(TARGET);
}

export default function RemovedProductsRoute() {
  return null;
}
