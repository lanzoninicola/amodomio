# Store Opening

## Visao geral
Este dominio centraliza o controle de horarios de funcionamento da loja.
Os horarios sao configurados via UI e armazenados na tabela `settings`.
O restante do app consome os dados prontos sem depender de variaveis de ambiente.

## Persistencia no banco
Contexto: `store-opening-hours`

Chaves salvas por dia da semana:
- `day-<n>-enabled`: `true` ou `false`
- `day-<n>-range`: string de 8 digitos (ex.: `19002200`)

Dias da semana seguem o padrao JavaScript:
- `0` = domingo
- `1` = segunda-feira
- ...
- `6` = sabado

## UI de gerenciamento
Rota: `/admin/atendimento/horarios`

Comportamento do input:
- Digite apenas numeros: `19002200`
- A UI formata para `19:00 - 22:00`
- O valor salvo no banco continua como `19002200`

## Fonte unica de verdade
Funcoes principais:
- `loadStoreOpeningSchedule()` carrega e normaliza o schedule do banco
- `computeStoreOpeningStatus()` calcula aberto/fechado para um horario
- `getStoreOpeningStatus()` combina as duas em server-side

## Onde e usado
- `app/hooks/use-store-opening-status.ts` consulta o status via API
- `app/routes/api.store-opening-status.tsx` expõe status atual via API

## Fallback padrao
Quando nao ha dados no banco, usa:
- dias: quarta a domingo
- horario: 18:00 a 22:00

Este fallback pode ser ajustado em:
- `app/domain/store-opening/store-opening-settings.ts` (`DEFAULT_STORE_OPENING`)
