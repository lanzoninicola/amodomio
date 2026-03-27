import { redirect, type LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.toString();
  return redirect(`/admin/stock-import-applied-changes${search ? `?${search}` : ''}`);
}

export default function AdminImportStockMovementsGlobalAppliedChangesRedirectRoute() {
  return null;
}
