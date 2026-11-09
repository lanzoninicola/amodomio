import type { ActionFunctionArgs } from '@remix-run/node';
import { embedSessionAllowsBatch } from '~/domain/auth/embed-session.server';
import { authenticator } from '~/domain/auth/google.server';
import { importStockMovementImportBatchStep } from '~/domain/stock-movement/stock-movement-import.server';
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
    if (!(await embedSessionAllowsBatch(user, request.headers.get('Cookie'), batchId)))
      return badRequest('Sessão sem acesso a este lote');

    const result = await importStockMovementImportBatchStep({
      batchId,
      actor,
      limit: 1,
    });

    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}
