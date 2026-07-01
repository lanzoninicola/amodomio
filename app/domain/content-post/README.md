# Content Posts

`ContentPost` é a fonte editorial única para conteúdos distribuídos em canais.

## Modelo

- `ContentPost`: título, legenda, chave estável e ciclo de vida editorial;
- `ContentPostMedia`: mídias canônicas e links associados;
- `ContentPublicationTarget`: configuração e estado desejado por canal;
- `ContentPublicationExecution`: histórico genérico de publicação e remoção.

## Canais atuais

- `cardapio-featured`: projeção de destaque no cardápio público;
- `whatsapp-status`: adaptador de Status via Z-API;
- `instagram-story`: adaptador de Stories via Instagram Graph API.

O cardápio não possui mais uma entidade editorial própria. Ele lê
`ContentPublicationTarget` ativos do canal `cardapio-featured`.

## Ciclo de vida

`ContentPost.status` controla o ciclo editorial do conteúdo. Cada
`ContentPublicationTarget.status` controla o estado daquele canal.

Estados de `ContentPublicationTarget` usados na operação:

- `draft`: canal desativado ou conteúdo editorial ainda não ativo;
- `needs_sync`: canal habilitado e configurado, pronto para publicação, mas
  ainda não publicado;
- `active`: canal publicado. Para canais com data, `lastPublishedAt` registra o
  momento da publicação;
- `failed`: última tentativa de publicação falhou;
- `removal_pending`: remoção/desativação solicitada, aguardando expiração da
  plataforma;
- `removed`: conteúdo removido ou já fora da janela de exibição.

Configurar um canal não deve marcar o target como `active`. A configuração
salva deixa o target em `needs_sync`; a transição para `active` acontece pela
ação explícita de publicar, registrada em `ContentPublicationExecution`.

No `cardapio-featured`, a publicação é uma projeção interna: o cardápio público
retorna apenas targets `enabled`, `active` e com `ContentPost.status = active`.
Salvar ajustes de um Cardápio já publicado preserva `active`; configurar ou
habilitar uma primeira vez deixa `needs_sync` até o operador publicar.

No `whatsapp-status`, legenda e mídias selecionadas pertencem à configuração do
grupo. Limpar o estado de publicação remove apenas dados de envio
(`lastPublishedAt`, status/resposta/erro da publicação e estado do target), sem
desvincular mídia nem legenda.

Quando o post sai do estado `active`:

1. `cardapio-featured` deixa de ser retornado imediatamente;
2. publicações do WhatsApp e Instagram são desativadas para impedir novos
   disparos;
3. alvos externos publicados nas últimas 24 horas entram em
   `removal_pending`;
4. uma execução `remove` registra que a plataforma precisa expirar o conteúdo
   quando a API não oferece remoção confiável.

Reativar o post reativa apenas os alvos marcados como `enabled`. Publicações
externas não são disparadas automaticamente.

## Tracking do cardápio

Código, arquivos e símbolos usam `cardapio-featured`. Os valores persistidos
dos eventos mantêm os nomes históricos `cardapio_highlight_*` para preservar a
série existente. O campo `value` continua recebendo uma chave estável, agora
`ContentPost.key`.

## Administração

```text
/admin/marketing/publicacoes
/admin/marketing/publicacoes/:id/conteudo
/admin/marketing/publicacoes/:id/midias
/admin/marketing/publicacoes/:id/canais
/admin/marketing/publicacoes/:id/whatsapp
/admin/marketing/publicacoes/:id/instagram
```

O endpoint unificado para schedulers é:

```text
POST /api/content-publication-targets/:targetId/publish
```

Ele exige a mesma API key dos publicadores existentes.
