# Media Domain Spec

Especificação funcional e técnica do domínio de gerenciamento de mídia (`/admin/assets`).

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
- Cria tabelas e índices do domínio de mídia

## Comportamento de File Manager

- Raiz (`Meu Drive`):
  - mostra pastas da raiz
  - mostra arquivos da raiz (quando `folder_path` vazio)
- Dentro de pasta:
  - mostra subpastas do nível atual
  - mostra apenas arquivos da pasta atual

## Ações de Pasta

- Criar pasta:
  - input na sidebar (`Criar pasta`)
  - cria no contexto da pasta atual
- Renomear pasta:
  - ícone `Pencil` na linha da pasta (sidebar)
  - com tooltip
- Excluir pasta:
  - ícone `Trash` na linha da pasta (sidebar)
  - com tooltip
  - remove pasta + descendentes + arquivos relacionados

## Ações de Arquivo

- Upload em lote com seleção de tipo (`Imagem`/`Vídeo`)
- Barra de progresso por arquivo no frontend
- Mover arquivo entre pastas
- Copiar URL pública
- Excluir arquivo

## Integração com Serviço Externo de Mídia

Upload usa endpoint externo via `POST /v2/upload` com query params:

- `kind=image|video`
- `folderPath=<pasta-do-asset>` (ou alias `path`)
- `assetKey=<chave-do-asset>`

Multipart esperado:

- campo `file`

Resposta esperada:

- `{ ok, kind, folderPath, assetKey, url }`

Compatibilidade:

- fallback para `POST /upload` só quando `/v2/upload` responder `404`
- campos legados (`menuItemId`/`slot`) não são dependência do fluxo principal

Healthcheck de infraestrutura:

- endpoint preferencial: `GET /healthcheck`
- fallback: `GET /health`
- usado pela admin page para indicar disponibilidade da media API

## Integração com Cardápio (vínculo item)

Quando uma imagem/vídeo é vinculada a um item de cardápio:

- o registro continua sendo salvo em `menu_item_gallery_images`
- o asset também é registrado em `media_assets`
- a pasta do asset é garantida em `media_folders` (ex.: `menu-items/<menuItemId>`)
- `menu_item_gallery_images.asset_id` passa a receber o `id` do `media_assets`

Com isso, o vínculo por item e o Media Drive compartilham o mesmo inventário de assets.

## Link público por pasta (feed de assets)

Para consumir assets de uma pasta no frontend público, use:

- `GET /api/media/folder-assets?folder=<path>`

Parâmetros opcionais:

- `kind=image|video` (default: `all`)
- `recursive=true|false` (default: `false`)
- `limit=1..200` (default: `100`)

Exemplo para reels (somente vídeos):

- `/api/media/folder-assets?folder=reels&kind=video`

## Variáveis de Ambiente

- `MEDIA_API_BASE_URL` (default: `https://media-api.amodomio.com.br`)
- `MEDIA_BASE_URL` (default: `https://media.amodomio.com.br`)
- `MEDIA_UPLOAD_API_KEY` (obrigatória para upload)

## Debug e Observabilidade

- Em falhas de ação, UI mostra painel `Debug da última falha` com:
  - `intent`
  - status HTTP
  - mensagem retornada
  - detalhe bruto da resposta
- Botão `Copiar debug` para colar diagnóstico em suporte/dev

## Regras de Segurança

- Sanitização de paths (`folder_path`) e nomes
- Bloqueio de path traversal (`..`)
- Validação de inputs em ações de pasta/arquivo

## Componentes de UI (shadcn)

Usar componentes shadcn sempre que aplicável:

- `Button`, `Input`, `Select`
- `Dialog`, `Tooltip`
- `Table`
- `toast`

## Próximos Passos Sugeridos

- Adicionar testes para:
  - criar/renomear/excluir pasta
  - upload em lote (sucesso parcial e total)
  - mover/excluir arquivo
- Monitorar ambientes legados e remover fallback para `/upload` após padronização total em `/v2/upload`
