import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";

function buildRedirectPath(channelKey?: string | null) {
  const channel = String(channelKey || "").trim();
  if (!channel) return "/admin/items";
  return `/admin/gerenciamento/cardapio/sell-price-management/${channel}/edit-items`;
}

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(buildRedirectPath(params.channel));
}

export async function action({ params }: ActionFunctionArgs) {
  return redirect(buildRedirectPath(params.channel));
}

export default function AdminGerenciamentoCardapioSellPriceManagementLegacyEditRedirect() {
  return null;
}
