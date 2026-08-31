import { describe, expect, it } from "vitest";
import { normalizeWebhookPayload } from "./webhook.parser";

describe("normalizeWebhookPayload", () => {
  it("extracts the provider message id used to deduplicate worker jobs", () => {
    const normalized = normalizeWebhookPayload("received", {
      phone: "5546999999999",
      messageId: "3EB0ABC123",
      text: { message: "Oi" },
    });

    expect(normalized.messageId).toBe("3EB0ABC123");
  });

  it("extracts a nested provider message id", () => {
    const normalized = normalizeWebhookPayload("received", {
      data: {
        phone: "5546999999999",
        message_id: "nested-message-id",
        text: "Quero atendimento",
      },
    });

    expect(normalized.messageId).toBe("nested-message-id");
  });
});
