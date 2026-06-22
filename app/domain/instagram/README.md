# Integração Instagram Stories

Esta integração conecta a conta profissional do Instagram da A Modo Mio ao
admin usando a Instagram Graph API com Login do Facebook para Empresas.

O objetivo final é publicar nos Stories as imagens configuradas em
`/admin/marketing/destaques-cardapio`.

## Estado atual

Já estão implementados:

- tela de conexão em `/admin/marketing/instagram`;
- início do OAuth em `/auth/facebook-business`;
- callback em `/auth/facebook-business/callback`;
- descoberta da Página do Facebook e da conta profissional vinculada;
- troca do token curto por token de longa duração;
- armazenamento criptografado do token;
- verificação e desconexão da conta;
- modelo Prisma `InstagramConnection`.

Ainda falta implementar:

- aba `Instagram` dentro de cada destaque;
- criação do container de mídia com `media_type=STORIES`;
- consulta do processamento do container;
- publicação pelo endpoint `media_publish`;
- histórico de publicações e execuções;
- endpoint protegido para agendamento.

## Arquivos principais

- `app/domain/instagram/instagram-facebook-login.server.ts`
- `app/routes/admin.marketing.instagram.tsx`
- `app/routes/auth.facebook-business.tsx`
- `app/routes/auth.facebook-business_.callback.tsx`
- `prisma/migrations/20260800000023_instagram_connections/migration.sql`

O nome do arquivo de callback contém `_` antes de `.callback` para que a rota
seja irmã da rota inicial no Remix. Os caminhos públicos continuam sendo:

```text
/auth/facebook-business
/auth/facebook-business/callback
```

Não renomeie o callback para
`auth.facebook-business.callback.tsx`: isso cria uma rota filha e pode causar
colisão de caminhos ou executar o loader da rota inicial durante o callback.

## Configuração no Meta for Developers

1. Abra o aplicativo **Amo do Mio Social Publisher**.
2. Use o caso de uso **Gerenciar mensagens e conteúdo no Instagram**.
3. Escolha a configuração com **Login do Facebook**.
4. Adicione as permissões obrigatórias de conteúdo:

```text
instagram_basic
instagram_content_publish
pages_read_engagement
pages_show_list
business_management
```

5. Não é necessário adicionar permissões de mensagens.
6. Confirme que:
   - a conta do Instagram é profissional;
   - ela está vinculada à Página do Facebook da A Modo Mio;
   - o usuário usado no login administra a Página.

### URIs OAuth válidas

Produção:

```text
https://www.amodomio.com.br/auth/facebook-business/callback
```

Desenvolvimento local, quando a Meta aceitar localhost:

```text
http://localhost:3000/auth/facebook-business/callback
```

As URIs devem ser idênticas às configuradas em
`META_FACEBOOK_CALLBACK_URL`, incluindo protocolo, domínio, porta e caminho.

## Variáveis de ambiente

```env
META_APP_ID=
META_APP_SECRET=
META_FACEBOOK_CALLBACK_URL=http://localhost:3000/auth/facebook-business/callback
META_FACEBOOK_LOGIN_CONFIG_ID=
META_FACEBOOK_PAGE_ID=
META_GRAPH_API_VERSION=v25.0
META_TOKEN_ENCRYPTION_SECRET=
META_OAUTH_COOKIE_SECRET=
```

### Origem de cada valor

`META_APP_ID`

: Meta for Developers → Configurações do app → Básico → Identificação do
aplicativo.

`META_APP_SECRET`

: Meta for Developers → Configurações do app → Básico → Chave secreta do
aplicativo.

`META_FACEBOOK_CALLBACK_URL`

: Callback deste sistema. Use localhost no desenvolvimento e o domínio público
na Vercel.

`META_FACEBOOK_LOGIN_CONFIG_ID`

: ID da configuração criada em Login do Facebook para Empresas. É opcional
durante o primeiro teste.

`META_FACEBOOK_PAGE_ID`

: ID da Página da A Modo Mio. É opcional quando somente uma Página autorizada
possui Instagram, mas recomendado para evitar selecionar a Página errada.

`META_GRAPH_API_VERSION`

: Versão utilizada pela integração. Atualmente `v25.0`.

`META_TOKEN_ENCRYPTION_SECRET`

: Chave exclusiva para cifrar o token armazenado no banco.

`META_OAUTH_COOKIE_SECRET`

: Chave exclusiva para assinar o cookie temporário usado na validação de
`state` do OAuth.

Gere as duas chaves locais com comandos separados:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Não use o mesmo valor nas duas variáveis. Não altere
`META_TOKEN_ENCRYPTION_SECRET` depois que uma conta estiver conectada: tokens
gravados anteriormente deixarão de poder ser descriptografados.

Nenhuma dessas variáveis deve usar o prefixo `VITE_`, pois são secrets
exclusivos do servidor.

## Configuração na Vercel

1. Abra Vercel → projeto → Settings → Environment Variables.
2. Cadastre todas as variáveis `META_*`.
3. Marque pelo menos o ambiente `Production`.
4. Use em produção:

```env
META_FACEBOOK_CALLBACK_URL=https://www.amodomio.com.br/auth/facebook-business/callback
```

5. Faça um novo deploy depois de salvar ou alterar variáveis.

Nunca copie o App Secret, tokens ou chaves para código, logs, screenshots ou
conversas.

## Banco de dados

A integração depende da tabela `instagram_connections`, criada por:

```text
prisma/migrations/20260800000023_instagram_connections/migration.sql
```

Antes de testar a conexão em um ambiente, confirme que essa migração foi
aplicada nele.

Como este repositório pode ter outras migrações pendentes, verifique primeiro:

```bash
npx prisma migrate status
```

Em produção, aplique as migrações somente depois de revisar toda a sequência
pendente:

```bash
npx prisma migrate deploy
```

Não execute `migrate deploy` automaticamente sem conferir as demais migrações
do checkout.

## Teste local

1. Preencha as variáveis `META_*` no `.env`.
2. Cadastre a URI localhost no painel da Meta.
3. Confirme que a migração existe no banco de desenvolvimento.
4. Reinicie o servidor sempre que alterar o `.env`:

```bash
npm run dev
```

5. Acesse:

```text
http://localhost:3000/admin/marketing/instagram
```

6. Confirme que todos os indicadores de configuração aparecem como
   `Configurado`.
7. Clique em **Conectar com Facebook**.
8. Autorize somente a Página da A Modo Mio.
9. Ao retornar, confirme Página, Instagram Account ID, usuário e validade do
   token.
10. Clique em **Verificar conexão**.

Se a Meta rejeitar localhost, use um túnel HTTPS:

```bash
cloudflared tunnel --url http://localhost:3000
```

Depois configure a mesma URL gerada nos dois lugares:

```env
META_FACEBOOK_CALLBACK_URL=https://URL-DO-TUNEL/auth/facebook-business/callback
```

```text
Meta → URIs de redirecionamento OAuth válidas
https://URL-DO-TUNEL/auth/facebook-business/callback
```

URLs gratuitas de túnel normalmente mudam ao reiniciar o processo.

## Fluxo técnico

1. O admin abre `/admin/marketing/instagram`.
2. O botão direciona para `/auth/facebook-business`.
3. O servidor cria um `state` aleatório e o grava em cookie HTTP-only.
4. O navegador é enviado para o diálogo OAuth da Meta.
5. A Meta retorna para `/auth/facebook-business/callback`.
6. O callback valida o `state`.
7. O código OAuth é trocado por um token.
8. O token é convertido em token de longa duração.
9. `/me/accounts` localiza a Página e `instagram_business_account`.
10. O token é cifrado com AES-256-GCM e armazenado em
    `instagram_connections`.

O token nunca é retornado ao navegador nem exibido no admin.

## Diagnóstico

### Colisão de rota no Vite

Mensagem:

```text
Route Path Collision: "/auth/facebook-business/callback"
```

Confirme que existe somente:

```text
app/routes/auth.facebook-business_.callback.tsx
```

Remova qualquer arquivo:

```text
app/routes/auth.facebook-business.callback.tsx
```

Depois pare e reinicie o Vite. O HMR pode manter a rota removida em memória:

```text
Ctrl+C
npm run dev
```

### Invalid OAuth redirect URI

- confira se a URI da Meta é exatamente igual à variável de ambiente;
- confira `http` versus `https`;
- confira `www`;
- confira porta `3000` no ambiente local;
- reinicie o servidor após alterar `.env`.

### Nenhuma Página com Instagram encontrada

- confirme que o Instagram é profissional;
- confirme o vínculo com a Página;
- confirme que o usuário do Facebook administra a Página;
- autorize novamente o acesso à Página;
- confira `META_FACEBOOK_PAGE_ID`, caso esteja preenchido.

### Mais de uma Página encontrada

Configure:

```env
META_FACEBOOK_PAGE_ID=ID_DA_PAGINA_AMODO_MIO
```

### Token não pode ser descriptografado

O valor de `META_TOKEN_ENCRYPTION_SECRET` mudou depois da conexão. Restaure a
chave anterior ou desconecte e conecte novamente para gravar um novo token.

### Erro `Insufficient Developer Role`

Esse erro costuma ocorrer quando o app está em desenvolvimento e o usuário ou
a conta não possui função válida no app. Confirme as funções do app ou faça o
login com o administrador do aplicativo e da Página.

## Retomada futura

Ao voltar a esta integração:

1. Leia este arquivo.
2. Abra `/admin/marketing/instagram` e verifique a conexão.
3. Confira a validade do token e use **Verificar conexão**.
4. Confira `npx prisma migrate status`.
5. Não altere a chave de criptografia já usada.
6. Para implementar Stories, comece em
   `app/domain/instagram/instagram-facebook-login.server.ts` e extraia um
   cliente Graph API reutilizável.
7. Crie a publicação em um módulo separado, por exemplo:

```text
app/domain/instagram/instagram-story-publication.server.ts
```

8. Mantenha histórico e execução separados do WhatsApp.
9. Depois de modificar rotas ou domínio, execute validações localizadas e
   atualize Graphify/wiki conforme `AGENTS.md`.
