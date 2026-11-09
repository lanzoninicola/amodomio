import { describe, expect, it } from "vitest";
import {
  buildConversationKnowledgeClusters,
  redactConversationExample,
} from "./conversation-knowledge";

describe("conversation knowledge extraction", () => {
  it("groups repeated normalized questions and ignores greetings", () => {
    const clusters = buildConversationKnowledgeClusters([
      { messageText: "Oi", createdAt: new Date("2026-09-01") },
      {
        messageText: "Qual a taxa de entrega no Centro?",
        createdAt: new Date("2026-09-02"),
      },
      {
        messageText: "qual taxa entrega centro",
        createdAt: new Date("2026-09-03"),
      },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({
      category: "entrega",
      occurrenceCount: 2,
    });
  });

  it("redacts contact data from review examples", () => {
    expect(
      redactConversationExample("Meu número é (46) 99999-0000 e a@b.com")
    ).toBe("Meu número é [telefone] e [email]");
  });
});
