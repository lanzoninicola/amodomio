import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';

export async function loader({ params }: LoaderFunctionArgs) {
  const batchId = String(params.batchId || '').trim();
  if (!batchId) {
    return redirect('/admin/supplier-reconciliation');
  }
  return redirect(`/admin/supplier-reconciliation?batchId=${batchId}`);
}

export default function AdminImportStockMovementsSupplierReconciliationRedirectRoute() {
  return null;
}
