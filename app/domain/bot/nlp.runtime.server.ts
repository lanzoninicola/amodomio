// /app/domain/bot/nlp.runtime.server.ts
import { loadActiveModel } from "./nlp.manager.server";

export async function nlpProcess(text: string) {
  const manager = await loadActiveModel();
  return manager.process("pt", text);
}
