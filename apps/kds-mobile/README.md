# Amodomio Mobile

Aplicativo React Native + Expo do Amodomio. O KDS é a primeira
funcionalidade disponível dentro do aplicativo.

## Requisitos

- Node 20.19.4 ou superior (recomendado: 20.20.0)
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
