# Amodomio Mobile

Aplicativo React Native + Expo do Amodomio. O KDS é a primeira
funcionalidade disponível dentro do aplicativo.

## Requisitos

- Node 22.13.0 ou superior (fixado em 22.23.2 no .nvmrc)
- Usuário ativo do Amodomio com acesso por senha habilitado
- Backend Remix acessível por HTTPS pelo dispositivo

## Configuração

1. Copie `.env.example` para `.env` e informe a URL pública do Amodomio.
2. Execute `npm install`.
3. Execute `npm start` e abra no Expo Go ou em um development build.

O endereço também pode ser alterado na tela de login. O token de sessão é
armazenado com `expo-secure-store`; a URL e o último quadro carregado ficam no
armazenamento local.

## API usada

O login oferece os atalhos A modo mio — Público (`https://www.amodomio.com.br`)
e Desenvolvimento (`http://localhost:3000`). O endereço também pode ser digitado.
Os mesmos atalhos estão no aplicativo Windows/Electron, que compartilha o login.
No Windows, localhost acessa o servidor de desenvolvimento no próprio computador.
No tablet, localhost é o próprio dispositivo; para acessar o computador pela
rede local, informe o IP dele.

A lista é configurada no editor genérico de `/admin/administracao/settings`,
contexto `mobile`, nome `login.servers`, tipo `json`. O registro é criado com os
dois atalhos padrão ao abrir essa página, sem sobrescrever configurações existentes.
O valor é uma lista de objetos com `name` e `url`. O app consulta a lista pública
em `https://www.amodomio.com.br/api/mobile/servers` ao abrir o login, sem enviar
credenciais, e mantém os atalhos padrão se a consulta falhar. Alterar a lista no
servidor público dispensa um novo APK; a seleção do servidor só é salva após login.

- `GET /api/mobile/servers`: nomes e endereços públicos dos atalhos de login.
- `POST /api/kds/mobile-auth`: login.
- `GET /api/kds/mobile-auth`: validação da sessão.
- `DELETE /api/kds/mobile-auth`: logout e revogação.
- `GET /api/kds/orders?date=YYYY-MM-DD`: pedidos.
- `PATCH /api/kds/orders`: status e sinalização para o forno.

Login, tela inicial e KDS acompanham a orientação do dispositivo, respeitando
a configuração de rotação automática do sistema. O KDS atualiza o quadro a cada quatro segundos.
Toque na data para abrir o calendário, navegar entre meses e selecionar um dia;
o botão Hoje retorna à data atual.

Em celulares, o KDS usa cartões compactos (duas colunas na vertical e quatro
na horizontal), filtros NP/AF/AS e ações rápidas AF/AS com os componentes
nativos do app. Toque novamente no filtro ativo para ver todos os pedidos
ativos; toque na comanda para acessar as demais etapas. Os botões Kanban e
Reduzida permitem escolher a visualização em celulares e tablets. Celulares
iniciam na visualização reduzida e tablets no Kanban. A escolha vale enquanto
o KDS estiver aberto e não altera pedidos ou preferências salvas.

## Distribuição interna e atualizações (EAS)

Para gerar o APK localmente no Linux, execute `npm run build:android:local`
na raiz do repositório ou nesta pasta. O comando entra na pasta mobile, ativa
o Node definido em `.nvmrc` pelo nvm e usa o perfil `preview` com `--local`.
Requer as ferramentas Android instaladas e autenticação no EAS.
Para escolher o arquivo de saída, use
`npm run build:android:local -- --output /caminho/amodomio.apk`.

Os perfis `preview` e `production` em `eas.json` geram APK para Android e
Ad Hoc para iPhones cadastrados. Nenhum deles envia o aplicativo às lojas.
Os canais de atualização são separados, mas ambos usam as variáveis do ambiente
EAS `production` e acessam o backend real. Testar em preview também pode alterar
pedidos reais.

Antes dos comandos abaixo, entre na pasta do app e ative seu Node:

```bash
cd apps/mobile
source ~/.nvm/nvm.sh
nvm install
nvm use
npm ci
```

Projeto vinculado: [@amodomio/amodomio](https://expo.dev/accounts/amodomio/projects/amodomio).
Backend de produção: `https://www.amodomio.com.br`.

### Vincular a conta e o projeto (já realizado; referência para outros ambientes)

```bash
npm run eas:login
npm run eas:setup
```

Escolha o proprietário correto no Expo. O setup grava o ID real do projeto em
`extra.eas.projectId` e a URL de atualizações em `updates.url` no `app.json`.
Versione essas alterações antes de gerar os builds. Não use IDs de exemplo.
A política `runtimeVersion: fingerprint` deve permanecer configurada.

Cadastre a URL HTTPS pública do backend no ambiente EAS `production`, usando
`eas env:create` ou o painel do projeto:

```bash
npx eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://www.amodomio.com.br --visibility plaintext
```

Essa URL é pública e fica embutida no aplicativo. Nunca coloque senhas ou tokens
em variáveis `EXPO_PUBLIC_*`. O `.env` local não é enviado para o build.

### Instalar nos aparelhos

```bash
# Android: APK independente do computador e do Expo Go
npm run build:android

# iPhone: após ativar a assinatura Apple Developer, cadastrar o aparelho
npm run device:register
npm run build:ios
```

O EAS guia a criação das credenciais e fornece o link de instalação. Informe
credenciais Apple somente no fluxo oficial do EAS/Apple, nunca em arquivos.
Novos iPhones precisam ser cadastrados e incluídos em novo build ou reassinatura.
Para testar antes de distribuir à operação, use `npm run build:preview`.

### Publicar uma atualização de telas/lógica

```bash
npm run update:preview -- --message "Descrição da alteração"
# Depois de testar no build preview:
npm run update:production -- --message "Descrição da alteração"
```

As atualizações são verificadas ao abrir o app, baixadas em segundo plano e
aplicadas em uma próxima abertura. Não forçamos reinício durante o atendimento.
Mudanças nativas/dependências/configurações que alterem o fingerprint exigem um
novo build instalado. EAS Update não transforma um build antigo sem suporte a
updates em um build compatível.

Deploy da Vercel atualiza o site/backend. Alterações em `apps/mobile` precisam
de EAS Update ou novo build conforme o tipo da mudança. Nenhum comando de
publicação é executado automaticamente pelo deploy da Vercel.

## WhatsApp da cozinha

Em `/admin/administracao/settings`, contexto `kds`, ative o booleano
`cozinha-whatsapp-enabled` (padrão: `false`). O registro é criado ao abrir
a lista de settings ou consultar a configuração no app. O servidor usa as
credenciais de WhatsApp já configuradas; nenhuma chave REST ou Z-API é
armazenada no dispositivo.

Nos cards de Reduzida e Kanban, o smartphone fica verde quando há telefone
e opaco quando não há. Toque nele, escreva a mensagem e toque em **Enviar
WhatsApp**. O envio é manual e não ocorre ao mudar o status do pedido.
A sessão precisa ter o perfil cozinha, atendimento ou administrador.

- `GET /api/kds/whatsapp`: configuração disponível para a sessão.
- `POST /api/kds/whatsapp`: `{ orderId, message }`; o servidor consulta o telefone
  do pedido, valida a configuração e registra o envio pelo serviço existente.

Os perfis exibidos em `/admin/users` são `kds-cozinha` e `kds-atendimento`.
A migração `20261012010000_rename_kds_roles` renomeia os valores do enum no
banco e preserva os vínculos existentes. Aplique as migrações no ambiente
de destino junto da atualização do servidor.
