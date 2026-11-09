# Rate Limit

Este modulo implementa um rate limit simples usando Prisma e cookie httpOnly.
Foi pensado para bloquear abuso de likes, mas pode ser reutilizado em outras partes.

## Como funciona

- Um cookie httpOnly `rate_limit_id` identifica o navegador.
- O IP e o cookie geram chaves de bucket.
- Cada bucket tem uma janela e um contador.
- Quando o limite estoura, a acao retorna o estado atual sem erro.

## Arquivos principais

- `app/domain/rate-limit/rate-limit.server.ts`
  - `getRateLimitId(request)` cria/recupera o cookie.
  - `getClientIp(request)` resolve o IP real (x-forwarded-for, x-real-ip, cf-connecting-ip, fly-client-ip).
  - `consumeRateLimitBucket({ key, limit, windowMs })` incrementa o bucket.
- `app/domain/rate-limit/like-rate-limit.server.ts`
  - Regra concreta para likes usando a logica acima.

## Regra usada para likes

Arquivo: `app/domain/rate-limit/like-rate-limit.server.ts`

- 1 like por item / 24h por `IP + cookie`
- 20 likes / 24h por `IP + cookie`
- 120 likes / 24h por `IP`

## Reutilizar em outras rotas

Exemplo basico:

```ts
import { getRateLimitId, getClientIp, consumeRateLimitBucket } from "~/domain/rate-limit/rate-limit.server";

export async function action({ request }: ActionFunctionArgs) {
  const { rateLimitId, headers } = await getRateLimitId(request);
  const ip = getClientIp(request) ?? "unknown";

  const bucketKey = `minha-rota:${ip}:${rateLimitId}`;
  const result = await consumeRateLimitBucket({
    key: bucketKey,
    limit: 10,
    windowMs: 60 * 1000,
  });

  if (!result.allowed) {
    return ok({ blocked: true }, { headers });
  }

  return ok({ blocked: false }, { headers });
}
```

Exemplo com chave por usuario (quando existir login):

```ts
import { getRateLimitId, getClientIp, consumeRateLimitBucket } from "~/domain/rate-limit/rate-limit.server";

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;

export async function action({ request }: ActionFunctionArgs) {
  const userId = "user-id-aqui";
  const { rateLimitId, headers } = await getRateLimitId(request);
  const ip = getClientIp(request) ?? "unknown";

  const bucketKey = `feedback:${userId}:${ip}:${rateLimitId}`;
  const result = await consumeRateLimitBucket({
    key: bucketKey,
    limit: LIMIT,
    windowMs: WINDOW_MS,
  });

  if (!result.allowed) {
    return ok({ blocked: true }, { headers });
  }

  return ok({ blocked: false }, { headers });
}
```

## Ajustes recomendados

- Definir limites diferentes por rota.
- Usar chave mais especifica quando fizer sentido (ex: `userId`).
- Criar um helper especifico por dominio, como foi feito para likes.
