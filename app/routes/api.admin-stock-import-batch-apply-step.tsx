import type { ActionFunctionArgs } from '@remix-run/node';
import { authenticator } from '~/domain/auth/google.server';
import { applyStockNfImportBatchStep } from '~/domain/stock-nf-import/stock-nf-import.server';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

function str(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    if (!user) return badRequest('Não autenticado');

    const actor = (user as any)?.email || (user as any)?.displayName || (user as any)?.name || null;
    const formData = await request.formData();
    const batchId = str(formData.get('batchId'));
    if (!batchId) return badRequest('Lote inválido');

    const result = await applyStockNfImportBatchStep({
      batchId,
      actor,
      limit: 1,
    });

    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}
