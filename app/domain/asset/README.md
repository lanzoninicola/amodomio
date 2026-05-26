# Asset Domain Spec

Especificação funcional e técnica do domínio de gerenciamento de assets (`/admin/assets`).

## Objetivo

Fornecer um gerenciador de assets genérico (imagens e vídeos), desacoplado de cardápio, com comportamento de file manager:

- navegação por pastas
- criação, renomeação e exclusão de pastas
- upload em lote
- listagem de arquivos por pasta
- cópia de URL pública
- movimentação e exclusão de arquivos

## Escopo

- Rota principal: `app/routes/admin.assets.tsx`
- Tipos e utilitários compartilhados: `app/domain/media/media.shared.ts`
- Serviço server (DB + integração externa): `app/domain/media/media.service.server.ts`
- Navegação admin: `app/domain/website-navigation/links/admin-navigation.ts` (`/admin/assets`)
- Persistência no banco: tabelas `media_folders` e `media_assets`

## Modelo de Dados

### `media_folders`

- `id: uuid`
- `path: text unique` (ex.: `reels`, `campanhas/inverno`)
- `name: text`
- `parent_path: text null`
- `created_at`
- `updated_at`

### `media_assets`

- `id: uuid`
- `kind: text` (`image` | `video`)
- `url: text` (URL pública retornada pelo serviço de mídia)
- `folder_path: text`
- `file_name: text`
- `storage_key: text null` (chave técnica de armazenamento)
- `size_bytes: bigint null` (tamanho do arquivo em bytes)
- `created_at`
- `updated_at`

## Migração

- Migration: `prisma/migrations/20260723002000_create_media_library_tables/migration.sql`
- Inclui `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- Cria tabelas e índices do domínio de assets

## Integração com Cardápio

Quando uma imagem/vídeo é vinculada a um item de cardápio:

- o registro é salvo em `item_gallery_images`
- o asset também é registrado em `media_assets`
- a pasta do asset é garantida em `media_folders` (ex.: `items/<itemId>`)
- `item_gallery_images.media_asset_id` recebe o `id` do `media_assets`

Com isso, o vínculo por item e a biblioteca de assets compartilham o mesmo inventário de arquivos.

## Variáveis de Ambiente

- `MEDIA_API_BASE_URL` (default: `https://media-api.amodomio.com.br`)
- `MEDIA_BASE_URL` (default: `https://media.amodomio.com.br`)
- `MEDIA_UPLOAD_API_KEY` (obrigatória para upload)

## Contrato de Upload Externo

Fluxo principal de upload usa `POST /v2/upload` com:

- query obrigatória: `kind=image|video`, `assetKey`
- query de pasta: `folderPath` (o serviço aceita alias `path`)
- multipart: campo `file`
- resposta esperada: `{ ok, kind, folderPath, assetKey, url }`

Exemplo de request:

- `POST /v2/upload?kind=image&folderPath=campanhas/inverno&assetKey=banner-home`
- header: `x-api-key: <MEDIA_UPLOAD_API_KEY>`
- multipart: `file=<arquivo>`

Exemplo de resposta v2:

```json
{
  "ok": true,
  "kind": "image",
  "folderPath": "campanhas/inverno",
  "assetKey": "banner-home",
  "url": "https://media.amodomio.com.br/images/campanhas/inverno/banner-home.jpg"
}
```

O contrato antigo `POST /upload` foi removido do backend. Falhas no `/v2/upload`
devem ser tratadas como erro de upload e exibidas ao operador.

## Healthcheck do Serviço

- endpoint preferencial: `GET /healthcheck`
- fallback: `GET /health`
- uso no admin: diagnóstico de conectividade exibido na tela `/admin/assets`
