# Item Assets Domain Spec

Especificação funcional e técnica do domínio de vínculo de assets (imagem/vídeo) com item nativo de cardápio.

## Objetivo

Permitir gerir assets de um item de cardápio com operações de:

- upload (arquivo)
- vínculo por URL
- definição de capa (somente imagem)
- visibilidade
- ordenação de galeria
- remoção de asset

## Escopo

- Shared/domain: `app/domain/menu-item-assets/menu-item-assets.shared.ts`
- Componente principal: `app/domain/menu-item-assets/components/menu-item-assets-form.tsx`
- Serviço de item: `app/domain/item/item-assets.server.ts`
- Rotas item (API): `app/routes/admin.items.$id.assets*.tsx`
- Tela item (admin): `app/routes/admin.items.$id.venda.galeria.tsx`
- Tela batch (admin): `app/routes/admin.gerenciamento.cardapio.assets-batch.tsx`

## Contrato de Rotas

Base: `/admin/items/:itemId/assets`

- `GET /assets`:
  - Retorna `{ primary, gallery, assets }`
- `POST /assets`:
  - Multipart (`file`) para upload
  - JSON (`url`) para vínculo por URL
- `PUT /assets/order`:
  - Body: `{ orderedIds: string[] }`
- `DELETE /assets/:assetId`
- `PATCH /assets/:assetId/primary`
- `PATCH /assets/:assetId/visibility`:
  - Body: `{ visible: boolean }`

## Especificação da Rota Batch

Rota: `/admin/gerenciamento/cardapio/assets-batch`

- Arquivo: `app/routes/admin.gerenciamento.cardapio.assets-batch.tsx`
- Método server: `loader` (sem `action` dedicado)
- Autenticação: obrigatória via `authenticator.isAuthenticated`

### Loader (batch)

- Busca `Item` ativos
- Ordena por `sortOrderIndex`, `name`
- Carrega `ItemGalleryImage` por item
- Normaliza payload para:
  - `items[]` com `id`, `name`, `active`, `visible`, `assets[]`
  - cada asset com `id`, `url`, `kind`, `slot`, `isPrimary`, `visible`, `sortOrder`, `createdAt`

### Operações de UI (batch)

A rota batch usa chamadas `fetch` para a API base por item:

- `GET /admin/items/:itemId/assets` para refresh do item selecionado
- `POST /admin/items/:itemId/assets` para upload de cada arquivo pendente
- `PATCH /admin/items/:itemId/assets/:assetId/primary` para definir capa
- `DELETE /admin/items/:itemId/assets/:assetId` para remover asset

### Regras funcionais no batch

- Seleção de múltiplos arquivos (`image/*,video/*`) por item
- Fila de pendentes por item (`pendingUploadsByItem`)
- Apenas imagem pode ser marcada como capa
- Upload é confirmado item a item (ação de salvar por linha)
- Após cada operação, o item selecionado é recarregado da API de assets

## Modelo de Dados Utilizado

### `item_gallery_images`

Tabela de vínculo do item com o asset exibido no cardápio:

- `item_id`
- `media_asset_id`
- `kind` (`image` | `video`)
- `secure_url`
- `is_primary`
- `visible`
- `sort_order`
- metadados do arquivo (nome, formato, dimensões, etc)

### Integração com biblioteca global de mídia

Durante criação de asset do item:

- pasta é garantida em `media_folders` (`items/<itemId>`)
- asset é criado/atualizado em `media_assets`
- vínculo em `item_gallery_images.media_asset_id`

Isso mantém os assets do cardápio visíveis em `/admin/assets`.

## Regras de Negócio

- Só imagem pode ser capa (`isPrimary`).
- Ao definir nova capa, as demais perdem `isPrimary`.
- Remoção da capa tenta promover próximo asset elegível.
- Ordenação manual afeta somente galeria (`isPrimary = false`).
- Visibilidade é controlada por asset (`visible`).

## Shared Utilities

`menu-item-assets.shared.ts` concentra:

- tipo `MenuItemAssetDto`
- builder de endpoints (`getItemAssetsApiEndpoints`)
- parser de resposta da API (`parseMenuItemAssetsApiResponse`)
- helper de pasta de mídia (`getItemMediaFolderPath`)

## Dependências de Ambiente

- `MEDIA_API_BASE_URL`
- `MEDIA_UPLOAD_API_KEY`

Sem `MEDIA_UPLOAD_API_KEY`, uploads por arquivo falham no backend.

## Contrato de Upload de Mídia

Upload de arquivo na API de assets do item delega para media API com contrato v2:

- endpoint principal: `POST /v2/upload`
- query: `kind=image|video`, `folderPath=items/<itemId>`, `assetKey=<chave-do-arquivo>`
- multipart: `file`
- resposta base: `{ ok, kind, folderPath, assetKey, url }`

O contrato antigo `POST /upload` não é usado nesse fluxo.
