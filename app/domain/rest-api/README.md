# REST API

## Visão geral

API REST autenticada via `x-api-key`. Todas as rotas ficam em `app/routes/api.*.tsx`.

**Base URL:** `https://<host>/api`

### Autenticação

Todas as rotas exigem o header:

```
x-api-key: <VITE_API_KEY>
```

Respostas de erro comuns:

| Status | `error` | Causa |
|--------|---------|-------|
| `401` | `unauthorized` | Header ausente ou chave inválida |
| `405` | `method_not_allowed` | Método HTTP incorreto |
| `429` | `too_many_requests` | Rate limit excedido (60 req/min por IP por padrão) |
| `500` | `internal_server_error` | Erro interno |

---

## Endpoints

### GET /api/measurement-units — Unidades de consumo

Retorna a lista de unidades de medida/consumo cadastradas.

**Rota:** `app/routes/api.measurement-units.tsx`

#### Query params (todos opcionais)

| Param | Valores | Descrição |
|-------|---------|-----------|
| `active` | `true` \| `false` | Filtra por status |
| `scope` | `global` \| `restricted` | Filtra por visibilidade |
| `kind` | `weight` \| `volume` \| `count` \| `custom` | Filtra por tipo |

#### Exemplos

```
GET /api/measurement-units
GET /api/measurement-units?active=true
GET /api/measurement-units?kind=weight
GET /api/measurement-units?active=true&scope=global
```

#### Resposta 200

```json
{
  "units": [
    {
      "id": "uuid",
      "code": "KG",
      "name": "Quilograma",
      "kind": "weight",
      "scope": "global",
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "code": "UN",
      "name": "Unidade",
      "kind": "count",
      "scope": "global",
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 2
}
```

#### Campos da unidade

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (UUID) | Identificador único |
| `code` | string | Código curto (`UN`, `KG`, `G`, `L`, `ML`) |
| `name` | string | Nome legível |
| `kind` | `weight` \| `volume` \| `count` \| `custom` \| null | Tipo de grandeza |
| `scope` | `global` \| `restricted` | `global` = disponível em todo o sistema; `restricted` = vinculada a itens específicos |
| `active` | boolean | Se a unidade está ativa |
| `createdAt` | ISO 8601 | Data de criação |
| `updatedAt` | ISO 8601 | Data da última atualização |

---

### GET /api/crm/customers — Busca de cliente por telefone

Verifica se um cliente existe no CRM pelo telefone.

**Rota:** `app/routes/api.crm.customers.tsx`

#### Query params

| Param | Obrigatório | Descrição |
|-------|-------------|-----------|
| `phone` | sim | Telefone em qualquer formato BR |

#### Resposta 200

```json
{ "exists": true, "customer": { "id": "uuid", "name": "João", "phone_e164": "+5544999999999" } }
{ "exists": false, "customer": null }
```

---

### GET /api/store-opening-status — Status de funcionamento da loja

Retorna se a loja está aberta ou fechada no momento.

**Rota:** `app/routes/api.store-opening-status.tsx`

---

## Modelo de dados — MeasurementUnit (Prisma)

```prisma
model MeasurementUnit {
  id        String   @id @default(uuid())
  code      String   @unique
  name      String
  kind      String?  // weight | volume | count | custom
  scope     String   @default("global") // global | restricted
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("measurement_units")
}
```

Unidades padrão inseridas por seed:

| Código | Nome | Tipo |
|--------|------|------|
| `UN` | Unidade | count |
| `KG` | Quilograma | weight |
| `G` | Grama | weight |
| `L` | Litro | volume |
| `ML` | Mililitro | volume |

---

## Implementação — padrão de autorização

```typescript
import { restApi } from "~/domain/rest-api/rest-api.entity.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    return json({ error: "unauthorized", message: auth.message }, { status: 401 });
  }
  // ...
}
```

A chave é lida da variável de ambiente `VITE_API_KEY` no servidor. O rate limit padrão é 60 req/min por IP, configurável via `VITE_REST_API_RATE_LIMIT_PER_MINUTE`.
