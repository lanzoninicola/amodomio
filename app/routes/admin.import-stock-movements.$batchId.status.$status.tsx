import { useParams } from '@remix-run/react';
import { AdminImportStockMovementsBatchLinesRoute } from './admin.import-stock-movements.$batchId._index';

export default function AdminImportStockMovementsBatchStatusRoute() {
  const params = useParams();

  return <AdminImportStockMovementsBatchLinesRoute forcedStatus={params.status} />;
}
