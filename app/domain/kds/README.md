# README — KDS REST API

Documentação objetiva da API REST criada para integrar pedidos do KDS e consultar delivery zones.

## Autenticação

Todos os endpoints exigem header:

```
x-api-key: <VITE_REST_API_SECRET_KEY>
```

Se ausente ou inválido, retorna 401.

## Endpoints

### 1) Listar delivery zones

Use este endpoint **antes** de criar pedidos quando precisar de `deliveryZoneId`.

```
GET /api/kds/delivery-zones
Headers:
  x-api-key: <REST_API_KEY>
```

Resposta:
```json
{
  "ok": true,
  "zones": [
    {
      "id": "uuid",
      "name": "Centro",
      "city": "Curitiba",
      "state": "PR",
      "zipCode": "80000-000",
      "createdAt": "2026-02-03T22:25:07.000Z",
      "updatedAt": "2026-02-03T22:25:07.000Z"
    }
  ]
}
```

### 2) Criar pedido (KDS)

```
POST /api/kds/orders
Headers:
  Content-Type: application/json
  x-api-key: <REST_API_KEY>
```

Payload mínimo:
```json
{
  "date": "YYYY-MM-DD",
  "commandNumber": 1
}
```

Payload completo (exemplo):
```json
{
  "date": "2026-02-03",
  "commandNumber": 123,
  "orderAmount": 89.90,
  "channel": "CARDÁPIO",
  "sizes": { "M": 1, "P": 2 },
  "hasMoto": true,
  "motoValue": 6.00,
  "takeAway": false,
  "deliveryZoneId": "ZONE_ID_AQUI",
  "isCreditCard": true,
  "customerName": "João Silva",
  "customerPhone": "41999998888"
}
```

Resposta:
```json
{
  "ok": true,
  "id": "uuid",
  "commandNumber": 123,
  "status": "novoPedido",
  "date": "2026-02-03",
  "dateInt": 20260203
}
```

## Regras e validações

- `commandNumber` é obrigatório (exceto quando `isVendaLivre = true`).
- `date` deve estar no formato `YYYY-MM-DD`.
- Se `deliveryZoneId` for informado, ele precisa existir; caso contrário retorna 400.
- Se a comanda já existir no dia, retorna 400 com `duplicate_command_number`.
- Se o dia estiver fechado, retorna 403 com `day_closed`.
- A API abre o dia automaticamente se estiver pendente.

## Erros comuns (exemplos)

```json
{ "error": "invalid_command_number" }
```

```json
{ "error": "duplicate_command_number", "commandNumber": 123 }
```

```json
{ "error": "invalid_delivery_zone_id", "deliveryZoneId": "ZONE_ID_AQUI" }
```

```json
{ "error": "day_closed" }
```

```json
{ "error": "foreign_key_violation", "field": "delivery_zone_id", "message": "Chave estrangeira inválida." }
```

## Exemplo rest.http

```
### Listar delivery zones
GET http://localhost:3000/api/kds/delivery-zones
x-api-key: {{REST_API_KEY}}

### Criar pedido mínimo
POST http://localhost:3000/api/kds/orders
Content-Type: application/json
x-api-key: {{REST_API_KEY}}

{
  "date": "2026-02-03",
  "commandNumber": 1
}
```

## Notas

- `sizes` aceita `{ F, M, P, I, FT }`.
- `size` também pode ser enviado como string JSON (compatível com o KDS atual).

