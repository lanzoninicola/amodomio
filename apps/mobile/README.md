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

- `POST /api/kds/mobile-auth`: login.
- `GET /api/kds/mobile-auth`: validação da sessão.
- `DELETE /api/kds/mobile-auth`: logout e revogação.
- `GET /api/kds/orders?date=YYYY-MM-DD`: pedidos.
- `PATCH /api/kds/orders`: status e sinalização para o forno.

Após o login, o aplicativo abre a tela inicial genérica em modo retrato. Ao
entrar no KDS, permite orientação horizontal ou vertical e atualiza o quadro a cada quatro segundos.
Toque na data para abrir o calendário, navegar entre meses e selecionar um dia;
o botão Hoje retorna à data atual.

Em celulares, o KDS usa cartões compactos (duas colunas na vertical e quatro
na horizontal), filtros NP/AF/AS e ações rápidas AF/AS com os componentes
nativos do app. Toque novamente no filtro ativo para ver todos os pedidos
ativos; toque na comanda para acessar as demais etapas. Tablets mantêm o Kanban.

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
