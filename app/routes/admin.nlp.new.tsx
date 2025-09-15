import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { NlpRepo } from '~/domain/bot/nlp.repository.server';
import { useEffect, useState } from 'react';

// shadcn/ui
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  // Toggle do guia – persiste em localStorage
  const [showGuide, setShowGuide] = useState<boolean>(true);
  useEffect(() => {
    const saved = localStorage.getItem('nlp:guide:new');
    if (saved != null) setShowGuide(saved === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('nlp:guide:new', showGuide ? '1' : '0');
  }, [showGuide]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nova intenção</h1>
        <div className="flex items-center gap-2">
          <Switch id="toggle-guide-new" checked={showGuide} onCheckedChange={setShowGuide} />
          <Label htmlFor="toggle-guide-new">Mostrar guia de uso</Label>
        </div>
      </div>

      {showGuide && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Guia rápido – Nova intenção</CardTitle>
            <CardDescription>Como preencher corretamente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              • <span className="font-medium">Nome técnico</span>: use um padrão estável, ex.: <code>cardapio.show</code>, <code>pedido.start</code>.
            </p>
            <p>
              • <span className="font-medium">Rótulo</span>: um nome amigável para aparecer na UI (ex.: “Mostrar cardápio”).
            </p>
            <p>
              • Após criar, adicione várias frases de treino na tela de edição e, ao final, treine o modelo na lista.
            </p>
          </CardContent>
        </Card>
      )}

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
