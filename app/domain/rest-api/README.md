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

### POST /api/nfe/conciliacao — Importação de estoque via NF-e

Cria um lote de importação de movimentação de estoque a partir dos dados de uma NF-e. Usado pela extensão de navegador integrada ao Saipos.

Se já existir um lote não-arquivado com o mesmo `numero_nfe`, a rota retorna o lote existente sem criar um novo.

**Rota:** `app/routes/api.nfe.conciliacao.tsx`

#### Body (JSON)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `fornecedor` | string | sim | Nome do fornecedor |
| `numero_nfe` | string | sim | Número da NF-e |
| `items` | array | sim | Lista de itens (ver abaixo) |
| `exportado_em` | ISO 8601 | não | Data/hora de emissão da NF-e |

**Item (`items[]`)**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | string | Nome do ingrediente |
| `unidade_entrada` | string | Unidade de entrada (ex: `KG`, `UN`) |
| `quantidade` | string | Quantidade no formato BR (ex: `"1,500"`) |
| `valor_total` | string | Valor total no formato BR (ex: `"29,16"`) |

#### Exemplo de body

```json
{
  "fornecedor": "Distribuidora XYZ",
  "numero_nfe": "12345",
  "exportado_em": "2026-03-31T14:00:00.000Z",
  "items": [
    { "nome": "Pistache", "unidade_entrada": "KG", "quantidade": "0,108", "valor_total": "29,16" },
    { "nome": "Farinha de Trigo", "unidade_entrada": "KG", "quantidade": "25,000", "valor_total": "87,50" }
  ]
}
```

#### Resposta 200

```json
{ "success": true, "url": "https://<host>/admin/import-stock-movements/<id>", "message": "Lote importacao criado." }
```

Quando o lote já existe:
```json
{ "success": true, "url": "https://<host>/admin/import-stock-movements/<id>", "message": "Lote já existente para esta NF-e." }
```

#### Erros específicos

| Status | `error` | Causa |
|--------|---------|-------|
| `400` | `invalid_json` | Corpo da requisição não é JSON válido |
| `400` | `validation_error` | Campo obrigatório ausente ou `items` vazio |
| `429` | `rate_limited` | Rate limit específico deste endpoint excedido |
| `500` | `internal_error` | Erro ao criar o lote |

> O lote criado recebe `sourceType: "rest_api"`. Ver seção [Modelo de dados — StockMovementImportBatch](#modelo-de-dados--stockmovementimportbatch-prisma) abaixo.

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

## Modelo de dados — StockMovementImportBatch (Prisma)

Representa um lote de importação de movimentações de estoque.

### Campo `sourceType`

Identifica a origem do lote:

| Valor | Origem | Função que cria o lote |
|-------|--------|------------------------|
| `file_upload` | Upload de planilha Excel/CSV pela interface web | `createStockMovementImportBatchFromFile` |
| `photo_vision` | Import via foto com ChatGPT Vision (cupom/nota fiscal) | `createStockMovementImportBatchFromVisionPayload` (default) |
| `rest_api` | Criado via REST API (ex: extensão de navegador NF-e) | `createStockMovementImportBatchFromVisionPayload` com `sourceType: "rest_api"` |

> **Nota:** `ItemImportAlias` usa `sourceType: "entrada_nf"` independentemente da origem do lote — os aliases são compartilhados entre todos os tipos de importação.

### Campo `status`

| Valor | Descrição |
|-------|-----------|
| `draft` | Criado, aguardando validação |
| `validated` | Validado, pronto para importar |
| `imported` | Importado com sucesso |
| `partial` | Importado parcialmente |
| `rolled_back` | Revertido |
| `archived` | Arquivado |

### Campo `importStatus`

| Valor | Descrição |
|-------|-----------|
| `idle` | Aguardando início |
| `importing` | Em progresso |
| `imported` | Concluído |
| `failed` | Falhou |

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

A chave é lida da variável de ambiente `VITE_REST_API_SECRET_KEY` no servidor. O rate limit padrão é 60 req/min por IP, configurável via `VITE_REST_API_RATE_LIMIT_PER_MINUTE`.
