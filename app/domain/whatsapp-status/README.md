# Whatsapp Status

Gerencia posts que serão enviados para o Status do WhatsApp via Z-API.

## Jornada operacional

1. O operador publica a mídia no servidor de mídia e recebe uma URL pública.
2. O operador cria um post em `Marketing > Whatsapp Status`.
3. O post pode ser de `text`, `image` ou `video`.
4. Ao salvar, a tela exibe uma URL absoluta específica do post:
   `POST /api/whatsapp-status/:id/publish`.
5. O scheduler externo chama essa URL no horário desejado com o header
   `x-api-key: VITE_REST_API_SECRET_KEY`.
6. Para Dokploy, a tela de detalhe do post exibe um script pronto para copiar
   no campo `Script` do schedule. Configure `VITE_REST_API_SECRET_KEY` como
   variável de ambiente do schedule/projeto no Dokploy.
7. Cada chamada autenticada ao endpoint específico do post cria um registro em
   `WhatsappStatusPublicationExecution`, permitindo conferir se o scheduler
   chamou a API e se a Z-API aceitou ou recusou o envio.
8. Quando a execução vem do Dokploy (`source: "dokploy"`), o sistema tenta
   enviar uma mensagem WhatsApp para o telefone configurado em `settings` com
   `context = whatsapp-status` e `name = scheduler.notification.phone`.

## Regras de domínio

- `active` significa que o post está habilitado para disparo pelo
  scheduler. Pode existir mais de um post ativo.
- `deletedAt` representa eliminação lógica. Posts eliminados continuam
  visíveis na lista quando o filtro permitir, mas não podem ser publicados nem
  reativados.
- O WhatsApp exibe atualizações de status por 24 horas a partir do post.
  O sistema não remove o registro depois de 24 horas; ele registra
  `lastPublishedAt` e calcula a janela de visibilidade para exibição na lista.
- Posts de texto exigem `message`.
- Posts de imagem exigem `imageUrl` HTTP/HTTPS. A legenda é opcional.
- Posts de vídeo exigem `videoUrl` HTTP/HTTPS. A legenda é opcional.
- A Z-API aceita imagem por link ou Base64, mas este domínio persiste URL
  HTTP/HTTPS para manter a jornada alinhada ao servidor de mídia.
- Para vídeo, a Z-API publica o arquivo informado pela URL. O arquivo deve estar
  acessível publicamente pelo servidor de mídia antes do disparo. A Z-API
  recomenda H.264 e limite de 100 MB para vídeos.
- O histórico de execuções registra `source`, `scheduleName`, horário de início,
  horário de fim, duração, resposta e erro. O script Dokploy gerado pela tela
  envia `source: "dokploy"` no corpo da chamada.
- A notificação de execução do scheduler não bloqueia a publicação: se o envio
  da mensagem falhar, o erro fica registrado nos campos de notificação da
  execução.

## Fontes

- WhatsApp Help Center: `https://faq.whatsapp.com/454876960047011/?locale=pt_BR&cms_platform=kaios`
- Z-API status de texto: `https://developer.z-api.io/status/send-text-status`
- Z-API status de imagem: `https://developer.z-api.io/status/send-image-status`
- Z-API status de vídeo: `https://developer.z-api.io/status/send-video-status`
