# Controle de envios da Z-API

Todos os métodos `POST /send-*` usados pelo cliente central verificam `GET /status` antes de enviar. Apenas `connected: true` permite o envio. Uma instância desconectada retorna HTTP 503, com `details.code = instance_disconnected`. Falha ou resposta inválida na consulta bloqueia o envio.

## Contrato REST

`POST /api/messages/text` continua recebendo `{ "phone": "5511999999999", "message": "Olá" }` e o header `x-api-key`. `POST /api/messages/video` segue o mesmo acompanhamento.

A resposta de aceitação agora é HTTP **202**, preservando os IDs do provedor e acrescentando:

```json
{
  "messageId": "id-do-provedor",
  "trackingId": "uuid-do-acompanhamento",
  "status": "accepted",
  "confirmed": false,
  "message": "Solicitação aceita. Consulte o status para confirmar o envio.",
  "statusUrl": "/api/messages/status/uuid-do-acompanhamento"
}
```

Consultar `GET /api/messages/status/:trackingId` com o mesmo `x-api-key`. Estados:

| Estado | Significado |
| --- | --- |
| `unknown` | Requisição iniciada, mas resultado não confirmado (inclusive timeout). |
| `accepted` | Z-API aceitou a solicitação; envio ainda não confirmado. |
| `sent` | Webhook confirmou envio para o WhatsApp. |
| `delivered` | Destinatário recebeu a mensagem. |
| `read` | Destinatário leu/ouviu a mensagem. |
| `failed` | Rejeição explícita ou webhook de falha. |

`confirmed` é verdadeiro apenas para `sent`, `delivered` e `read`. Depois de 5 minutos sem confirmação, a consulta informa `confirmationOverdue: true`; isso **não prova falha**. O painel `/admin/zapi/envios` mostra os últimos 30 envios e a conexão atual.

Em erros depois de iniciar o envio, `details.trackingId` permite acompanhar o resultado. Não reenviar automaticamente após timeout, erro de rede, resposta sem ID ou falha de atualização do acompanhamento: o provedor pode ter aceitado a mensagem. Esta implementação não cria uma fila de reenvio nem deduplica novas solicitações REST do cliente.

## Configuração de produção

1. Configure **`ZAPI_WEBHOOK_SECRET`** no servidor com um valor longo e aleatório. É um segredo exclusivo do servidor, sem prefixo `VITE_`; não use o token da instância ou a chave REST.
2. Após publicar as rotas, cadastre no painel da Z-API, na instância usada pela aplicação:
   - **Ao enviar / delivery:** `https://SEU_DOMINIO/webhooks/zapi/delivery?secret=SEGREDO_URL_ENCODED`
   - **Status da mensagem:** `https://SEU_DOMINIO/webhooks/zapi/message-status?secret=SEGREDO_URL_ENCODED`
3. Preserve as URLs já existentes de recebimento e desconexão. Não use a atualização de todos os webhooks, pois ela sobrescreveria outras integrações.
4. Reconecte a instância no painel Z-API. Em seguida, faça um envio controlado e consulte o status até chegar a `sent`, `delivered` ou `read`. Confira também o destinatário.

Os callbacks exigem POST, segredo válido (query `secret` ou header `x-zapi-webhook-secret`), `instanceId` correspondente e payload válido. Sem segredo configurado retornam 503; segredo inválido retorna 401. Erros de banco retornam erro HTTP para permitir nova tentativa do provedor. Não registrar URLs completas com a query secreta em logs de proxy/observabilidade.

Referências oficiais: [conexão](https://developer.z-api.io/instance/status), [envio](https://developer.z-api.io/webhooks/on-message-send), [status](https://developer.z-api.io/webhooks/on-whatsapp-message-status-changes).

## Reconectar pelo painel

Administradores (`admin` ou `superAdmin`) podem usar **Tentar reconectar** em `/admin/zapi/envios`. A operação verifica a conexão antes de agir. Se estiver desconectada, chama `/restart` uma vez e consulta a conexão até quatro vezes, com intervalo de dois segundos. Se a sessão continuar desconectada, solicita o QR Code de pareamento.

O QR Code fica visível por até 20 segundos, com verificações de conexão durante esse período. Depois de expirar, use **Gerar novo QR Code**; essa ação não reinicia a instância. **Verificar conexão** também não reinicia. Se o WhatsApp pedir autenticação adicional por Challenge, a tela orienta concluir pelo painel Z-API.

As ações exigem sessão de administrador, POST da origem permitida e controle de frequência. A reinicialização permite uma tentativa por minuto por IP, seguindo o rate limiter existente da aplicação. Todos os tokens ficam no servidor; o navegador recebe somente o estado e a imagem de pareamento. A reinicialização não altera registros históricos, não apaga a sessão e não reenvia mensagens.

Referências: [reiniciar instância](https://developer.z-api.io/instance/restart) e [QR Code em imagem](https://developer.z-api.io/instance/qr-code-image).

## Persistência e CRM

Usa as tabelas existentes `wpp_events` e `crm_customer_event`; nenhuma alteração de schema ou migração é necessária. O acompanhamento é criado antes do POST e existe mesmo para telefones ausentes do CRM. Callbacks normalizados são persistidos e deduplicados por hash de instância, IDs, estado e erro. Um lock transacional de PostgreSQL serializa atualizações concorrentes da instância. Callbacks anteriores à resposta HTTP são reconciliados quando os IDs ficam disponíveis, incluindo a associação de `zaapId` com `messageId`.

No CRM, mensagens aceitas são `WHATSAPP_PENDING`, falhas são `WHATSAPP_FAILED` e somente confirmações de envio são `WHATSAPP_SENT`. O mesmo evento é atualizado, sem gerar um evento por mudança de estado. A conversa mostra o estado; relatórios de mensagens enviadas continuam contando somente `WHATSAPP_SENT`. Logs especializados que chamam `logCrmWhatsappSentEventByPhone` com `payload.wppResponse` aproveitam automaticamente o acompanhamento central.

Registros históricos não são reinterpretados: não há evidência para saber se mensagens anteriormente marcadas como enviadas chegaram ao destinatário. Indicadores de outros fluxos de negócio (campanhas, lotes, alertas) ainda podem representar a aceitação da solicitação; o estado de envio efetivo deve ser consultado no acompanhamento central.
