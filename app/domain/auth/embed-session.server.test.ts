import { describe, expect, it } from "vitest";
import {
  commitEmbedSession,
  createEmbedToken,
  embedCookiePath,
  embedSessionAllowsBatch,
  readEmbedUser,
  verifyEmbedToken,
} from "./embed-session.server";

describe("embed session", () => {
  it("accepts only a token signed for the same batch", () => {
    const token = createEmbedToken("batch-1");
    expect(verifyEmbedToken("batch-1", token)).toBe(true);
    expect(verifyEmbedToken("batch-2", token)).toBe(false);
    expect(verifyEmbedToken("batch-1", `${token}x`)).toBe(false);
    expect(verifyEmbedToken("batch-1", null)).toBe(false);
    expect(verifyEmbedToken("batch-1", "1.abc")).toBe(false);
  });
  it("issues a partitioned cookie limited to the batch path", async () => {
    const [cookie, apiCookie] = await commitEmbedSession("batch-1");
    expect(apiCookie).toContain("Path=/api/admin-stock-import-batch-import-step");
    expect(cookie).toContain(`Path=${embedCookiePath("batch-1")}`);
    expect(cookie).toMatch(/SameSite=None/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/Partitioned/);
    const user = await readEmbedUser(cookie.split(";")[0]);
    expect(user && user.email).toBe("suitable-extension");
    expect(await readEmbedUser(null)).toBeNull();
    expect(await readEmbedUser("__embed_stock=forged")).toBeNull();
  });
  it("limits the embed session to its own batch", async () => {
    const [cookie] = await commitEmbedSession("batch-1");
    const header = cookie.split(";")[0];
    const user = await readEmbedUser(header);
    expect(await embedSessionAllowsBatch(user, header, "batch-1")).toBe(true);
    expect(await embedSessionAllowsBatch(user, header, "batch-2")).toBe(false);
    const admin = { name: "A", email: "a@b.c", avatarURL: "" };
    expect(await embedSessionAllowsBatch(admin, null, "batch-2")).toBe(true);
  });
});
