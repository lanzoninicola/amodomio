import type { getAiKnowledgeSnapshot } from "./ai-knowledge.server";

type Rule = {
  label: string;
  trigger: string;
  isRegex: boolean;
  response: string;
  activeFrom: Date | null;
  activeTo: Date | null;
};

type Snapshot = Awaited<ReturnType<typeof getAiKnowledgeSnapshot>>;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function findMatchingDeterministicRule(
  rules: Rule[],
  text: string,
  now = new Date()
) {
  const normalizedText = normalize(text);
  return (
    rules.find((rule) => {
      if (rule.activeFrom && now < rule.activeFrom) return false;
      if (rule.activeTo && now > rule.activeTo) return false;
      if (!rule.trigger.trim()) return false;
      if (!rule.isRegex) {
        return normalizedText.includes(normalize(rule.trigger));
      }
      try {
        return new RegExp(rule.trigger, "iu").test(text);
      } catch {
        return false;
      }
    }) ?? null
  );
}

export function renderDeterministicTemplate(
  template: string,
  snapshot: Snapshot
) {
  const company = snapshot.structured.locations[0];
  const values: Record<string, string | null | undefined> = {
    "company.name": company?.name,
    "company.address": company?.address,
    "company.city": company?.city,
    "company.state": company?.state,
    "company.phone": company?.phoneNumber,
    "links.menu": snapshot.structured.publicLinks.menu,
    "links.order": snapshot.structured.publicLinks.order,
  };
  const missing: string[] = [];
  const response = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = values[key];
    if (!value) {
      missing.push(key);
      return `{{${key}}}`;
    }
    return value;
  });
  return { response, missing: [...new Set(missing)] };
}
