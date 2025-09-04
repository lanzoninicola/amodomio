export type WppSessionStatus =
  | "pending"
  | "qrcode"
  | "connected"
  | "logout"
  | "error";

export interface SendMessagePayload {
  to: string; // E.164 ou local (ex.: "5546999999999")
  text: string;
}
