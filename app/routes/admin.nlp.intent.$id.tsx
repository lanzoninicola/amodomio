import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, useNavigation } from '@remix-run/react';
import { NlpRepo } from '~/domain/bot/nlp.repository.server';
import { useEffect, useState } from 'react';

// shadcn/ui
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

  // Toggle do guia – persiste em localStorage
  const [showGuide, setShowGuide] = useState<boolean>(true);
  useEffect(() => {
    const saved = localStorage.getItem('nlp:guide:intent');
    if (saved != null) setShowGuide(saved === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('nlp:guide:intent', showGuide ? '1' : '0');
  }, [showGuide]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editar intenção</h1>
        <div className="flex items-center gap-2">
          <Switch id="toggle-guide-intent" checked={showGuide} onCheckedChange={setShowGuide} />
          <Label htmlFor="toggle-guide-intent">Mostrar guia de uso</Label>
        </div>
      </div>

      {showGuide && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Guia rápido – Edição da intenção</CardTitle>
            <CardDescription>Como usar esta página</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              • Edite o <span className="font-medium">rótulo</span> e use “Salvar”. Para habilitar/pausar a intenção,
              use o checkbox <span className="font-medium">“Ativa”</span> e “Aplicar”.
            </p>
            <p>
              • Em <span className="font-medium">Frases de treino</span> adicione exemplos variados que os clientes
              escreveriam. Isso ajuda o NLP a identificar melhor esta intenção.
            </p>
            <p>
              • Após ajustar intenções e frases, volte na lista e clique em <span className="font-medium">“Treinar modelo”</span>
              para gerar uma nova versão do modelo.
            </p>
            <p>
              • Dica: mantenha frases reais (copie de conversas antigas) e evite duplicar exemplos idênticos.
            </p>
          </CardContent>
        </Card>
      )}

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
