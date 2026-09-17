# Amodomio KDS Mobile

Aplicativo React Native + Expo para o Kanban de atendimento do KDS.

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

O quadro é atualizado a cada quatro segundos enquanto o app está em primeiro plano.
