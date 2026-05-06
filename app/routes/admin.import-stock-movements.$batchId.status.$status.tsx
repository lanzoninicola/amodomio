import { useParams } from '@remix-run/react';
import { AdminImportStockMovementsBatchLinesRoute } from '~/components/admin/import-stock-lines';

export default function AdminImportStockMovementsBatchStatusRoute() {
  const params = useParams();
  return <AdminImportStockMovementsBatchLinesRoute layout="cards" forcedStatus={params.status} />;
}
