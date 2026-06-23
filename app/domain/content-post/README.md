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
