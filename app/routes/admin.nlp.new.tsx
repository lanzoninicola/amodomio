// /app/routes/admin.nlp.new.tsx
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { NlpRepo } from '~/domain/bot/nlp.repository.server';

export async function loader({ request }: LoaderFunctionArgs) {
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const name = String(form.get('name') || '').trim();
  const label = String(form.get('label') || '').trim();
  const created = await NlpRepo.createIntent({ name, label });
  return redirect(`/admin/nlp/intent/${created.id}`);
}

export default function NewIntent() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Nova intenção</h1>
      <Form method="post" className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm mb-1">Nome técnico (ex.: cardapio.show)</label>
          <input name="name" className="border rounded px-3 py-2 w-full" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Rótulo</label>
          <input name="label" className="border rounded px-3 py-2 w-full" required />
        </div>
        <button className="px-4 py-2 border rounded">Criar</button>
      </Form>
    </div>
  );
}
