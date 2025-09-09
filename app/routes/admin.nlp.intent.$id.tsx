// /app/routes/admin.nlp.intent.$id.tsx
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, useNavigation } from '@remix-run/react';
import { NlpRepo } from '~/domain/bot/nlp.repository.server';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const intent = await NlpRepo.getIntent(params.id!);
  if (!intent) throw new Response('Not found', { status: 404 });
  return json({ intent });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const _action = form.get('_action');

  if (_action === 'add-utt') {
    const text = String(form.get('text') || '');
    await NlpRepo.addUtterance(params.id!, text);
    return redirect('.');
  }
  if (_action === 'rename') {
    const label = String(form.get('label') || '');
    await NlpRepo.updateIntent(params.id!, { label });
    return redirect('.');
  }
  if (_action === 'toggle') {
    const isActive = form.get('isActive') === 'on';
    await NlpRepo.updateIntent(params.id!, { isActive });
    return redirect('.');
  }
  return redirect('.');
}

export default function IntentEdit() {
  const { intent } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const busy = nav.state !== 'idle';

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Editar intenção</h1>

      <Form method="post" className="flex items-center gap-2">
        <input type="text" name="label" defaultValue={intent.label} className="border rounded px-3 py-2" />
        <button name="_action" value="rename" className="px-3 py-2 border rounded">Salvar</button>
        <label className="inline-flex items-center gap-2 ml-4">
          <input type="checkbox" name="isActive" defaultChecked={intent.isActive} />
          Ativa
        </label>
        <button name="_action" value="toggle" className="px-3 py-2 border rounded">Aplicar</button>
      </Form>

      <div className="space-y-3">
        <div className="font-medium">Frases de treino</div>
        {intent.utterances.map((u: any) => (
          <div key={u.id} className="p-3 border rounded">{u.text}</div>
        ))}
      </div>

      <Form method="post" className="flex items-center gap-2">
        <input name="text" placeholder="Adicionar frase…" className="border rounded px-3 py-2 w-full" />
        <button name="_action" value="add-utt" className="px-3 py-2 border rounded" disabled={busy}>Adicionar</button>
      </Form>
    </div>
  );
}
