// /app/domain/bot/nlp.manager.server.ts
// @ts-ignore
import { NlpManager } from "node-nlp";
import { NlpRepo } from "./nlp.repository.server";

let cached: { manager: NlpManager | null; modelId?: string } = {
  manager: null,
};

export async function trainFromDb() {
  const manager = new NlpManager({ languages: ["pt"], forceNER: true });

  // intents + utterances
  const intents = await NlpRepo.listIntents();
  for (const it of intents) {
    for (const utt of it.utterances) {
      manager.addDocument("pt", utt.text, it.name);
    }
  }

  // entities (gazetteer)
  const entities = await NlpRepo.listEntities();
  for (const e of entities) {
    for (const ex of e.examples) {
      manager.addNamedEntityText(e.name, ex.value, ["pt"], ex.synonyms);
    }
  }

  await manager.train();
  const exported = manager.export();
  const model = await NlpRepo.createModelVersion(exported, "auto");
  cached = { manager, modelId: model.id };
  return model;
}

export async function loadActiveModel(): Promise<NlpManager> {
  if (cached.manager) return cached.manager;

  const active = await NlpRepo.getActiveModel();
  if (!active) {
    await trainFromDb();
    return cached.manager!;
  }

  const manager = new NlpManager({ languages: ["pt"], forceNER: true });
  manager.import(active.artifact as any);
  cached = { manager, modelId: active.id };
  return manager;
}
