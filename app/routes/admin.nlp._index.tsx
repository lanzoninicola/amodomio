// /app/routes/admin.nlp._index.tsx
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, Link } from '@remix-run/react';
import { NlpRepo } from '~/domain/bot/nlp.repository.server';
import { trainFromDb } from '~/domain/bot/nlp.manager.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const intents = await NlpRepo.listIntents();
  return json({ intents });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const _action = form.get('_action');

  if (_action === 'train') {
    const model = await trainFromDb();
    return json({ ok: true, modelId: model.id });
  }
  return json({ ok: true });
}

export default function NlpIndex() {
  const { intents } = useLoaderData<typeof loader>();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">NLP – Intenções</h1>
        <Form method="post">
          <button name="_action" value="train" className="px-4 py-2 rounded-lg border">
            Treinar modelo
          </button>
        </Form>
      </div>

      <div className="grid gap-4">
        {intents.map((it: any) => (
          <Link key={it.id} to={`./intent/${it.id}`} className="p-4 rounded-lg border hover:bg-muted">
            <div className="font-medium">
              {it.label} <span className="text-muted-foreground">({it.name})</span>
            </div>
            <div className="text-sm text-muted-foreground">{it.utterances.length} frases</div>
          </Link>
        ))}
      </div>

      <Link to="./new" className="px-4 py-2 rounded-lg border w-fit">+ Nova intenção</Link>
    </div>
  );
}
