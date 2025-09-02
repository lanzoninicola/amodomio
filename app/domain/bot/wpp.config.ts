export const WppConfig = {
  // base URL vem do .env em runtime no server (ver wpp.server.ts)
  // mapeamento de endpoints baseado no swagger.json (ajuste nomes conforme seu server):
  paths: {
    startSession: (session: string) => `/api/${session}/start-session`,
    statusSession: (session: string) => `/api/${session}/status-session`,
    qrcodeImage: (session: string) => `/api/${session}/qrcode-image`,
    sendMessage: (session: string) => `/api/${session}/send-message`,
  },
};
