// app/routes/admin/nlp/_index.tsx
import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import {
  useLoaderData,
  Form,
  Link,
  useFetcher,
} from '@remix-run/react';
import { useEffect, useMemo, useState } from 'react';
import { NlpRepo } from '~/domain/bot/nlp.repository.server';
import { trainFromDb } from '~/domain/bot/nlp.manager.server';

// shadcn/ui
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

// ícones (lucide-react)
import {
  BrainCog,
  Loader2,
  CheckCircle2,
  Info,
  Plus,
} from 'lucide-react';

export async function loader({ request }: LoaderFunctionArgs) {
  const intents = await NlpRepo.listIntents();
  return json({ intents });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const _action = form.get('_action');

  console.log({ action: _action })

  if (_action === 'train') {
    console.log('training model...');
    const model = await trainFromDb();
    return json({ ok: true, modelId: model.id });
  }
  return json({ ok: true });
}

type TrainStatus = 'idle' | 'starting' | 'training' | 'done' | 'error';

export default function NlpIndex() {
  const { intents } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  // guia de uso
  const [showGuide, setShowGuide] = useState<boolean>(true);
  useEffect(() => {
    const saved = localStorage.getItem('nlp:guide:index');
    if (saved != null) setShowGuide(saved === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('nlp:guide:index', showGuide ? '1' : '0');
  }, [showGuide]);

  // estados de treinamento
  const [status, setStatus] = useState<TrainStatus>('idle');
  const [modelId, setModelId] = useState<string | null>(null);

  // quando o fetcher muda de estado, atualiza a UI
  useEffect(() => {
    // ao enviar
    if (fetcher.state === 'submitting') {
      setStatus('training');
      setModelId(null);
    }
    // ao receber resposta
    if (fetcher.state === 'idle' && fetcher.data) {
      if ((fetcher.data as any).ok) {
        setStatus('done');
        setModelId((fetcher.data as any).modelId ?? null);
      } else {
        setStatus('error');
      }
    }
  }, [fetcher.state, fetcher.data]);

  const totalUtterances = useMemo(
    () =>
      intents.reduce(
        (acc: number, it: any) => acc + (it?.utterances?.length ?? 0),
        0
      ),
    [intents]
  );

  const isBusy = status === 'starting' || status === 'training';

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BrainCog className="h-6 w-6" />
            NLP – Intenções
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {intents.length} intenção(ões) • {totalUtterances} frase(s) de treino
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <Badge variant="secondary">
              Modelo: {modelId ? `versão ${modelId.slice(0, 8)}…` : '—'}
            </Badge>
          </div>

          {/* Botão Treinar (fetcher + estados) */}
          <fetcher.Form method="post">
            <input type="hidden" name="_action" value="train" />
            <Button
              type="submit"
              onClick={() => setStatus('starting')}
              disabled={isBusy}
              className="gap-2"
            >
              {status === 'idle' && (
                <>
                  <BrainCog className="h-4 w-4" />
                  Treinar modelo
                </>
              )}
              {status === 'starting' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Iniciando…
                </>
              )}
              {status === 'training' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Treinando…
                </>
              )}
              {status === 'done' && (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Treino concluído
                </>
              )}
              {status === 'error' && (
                <>
                  <Info className="h-4 w-4" />
                  Erro ao treinar
                </>
              )}
            </Button>
          </fetcher.Form>
        </div>
      </div>

      {/* Feedback visual do treinamento */}
      {(status === 'starting' || status === 'training') && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Treinando modelo</CardTitle>
            <CardDescription>
              Estamos gerando uma nova versão a partir das intenções e entidades do banco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Etapa {status === 'starting' ? '1/2' : '2/2'}
              </span>
              <span className="font-medium">
                {status === 'starting' ? 'Preparando dados…' : 'Ajustando parâmetros…'}
              </span>
            </div>
            <Progress value={status === 'starting' ? 35 : 80} />
            <p className="text-xs text-muted-foreground">
              Isso pode levar alguns minutos conforme a quantidade de frases.
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'done' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Modelo treinado com sucesso!</AlertTitle>
          <AlertDescription>
            Nova versão {modelId ? <code>{modelId}</code> : '—'} pronta para uso.
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Falha ao treinar</AlertTitle>
          <AlertDescription>
            Tente novamente. Se persistir, verifique logs e conectividade com a base.
          </AlertDescription>
        </Alert>
      )}

      {/* Guia de uso */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-guide-index"
            checked={showGuide}
            onCheckedChange={setShowGuide}
          />
          <Label htmlFor="toggle-guide-index">Mostrar guia de uso</Label>
        </div>
      </div>

      {showGuide && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Guia rápido – Lista de Intenções</CardTitle>
            <CardDescription>Como usar esta página</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              • Aqui você vê todas as intenções cadastradas, a quantidade de frases de treino e pode acessar a edição.
            </p>
            <p>
              • Clique em <span className="font-medium">“Treinar modelo”</span> para gerar uma nova versão do modelo NLP a partir dos dados do banco.
            </p>
            <p>
              • Para criar uma nova intenção, use o botão <span className="font-medium">“+ Nova intenção”</span> abaixo.
            </p>
            <p>
              • Após treinar, a versão ativa é utilizada pelo runtime automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de intenções */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Intenções</h2>
          <Link to="./new">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova intenção
            </Button>
          </Link>
        </div>
        <Separator />
        {intents.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhuma intenção cadastrada ainda. Clique em <span className="font-medium">“Nova intenção”</span> para começar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {intents.map((it: any) => (
              <Link key={it.id} to={`./intent/${it.id}`}>
                <Card className="hover:bg-muted/40 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{it.label}</CardTitle>
                    <CardDescription className="truncate">{it.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4 text-sm text-muted-foreground">
                    {it.utterances.length} frase(s)
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
