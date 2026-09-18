import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findFirst: vi.fn() }));
vi.mock("~/lib/prisma/client.server", () => ({ default: { userAccess: mocks } }));
vi.mock("~/domain/auth/google.server", async () => {
  const { createCookieSessionStorage, redirect } = await import("@remix-run/node");
  const storage = createCookieSessionStorage({ cookie: { name: "test", secrets: ["test-secret"], path: "/" } });
  return {
    sessionStorage: storage,
    authenticator: {
      sessionKey: "user",
      isAuthenticated: async (request: Request) => (await storage.getSession(request.headers.get("Cookie"))).get("user"),
      logout: async (request: Request) => redirect("/login", { headers: { "Set-Cookie": await storage.destroySession(await storage.getSession(request.headers.get("Cookie"))) } }),
    },
  };
});
import { sessionStorage } from "~/domain/auth/google.server";
import { action } from "./api.auth.refresh-session";

async function refresh(user: unknown = { id: "u1", email: "admin@example.com", roles: ["user"] }, options: { method?: string; origin?: string } = {}) {
  const session = await sessionStorage.getSession();
  if (user) session.set("user", user);
  const cookie = await sessionStorage.commitSession(session);
  return action({ request: new Request("http://localhost/api/auth/refresh-session", {
    method: options.method || "POST",
    headers: { Cookie: cookie.split(";")[0], ...(options.origin ? { Origin: options.origin } : {}) },
  }), params: {}, context: {} });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue({ id: "u1", username: "admin", email: "admin@example.com", name: "Admin", roles: ["admin"], isActive: true, passwordHash: "never-serialize" });
});

it("renews the signed cookie with current database roles and excludes sensitive fields", async () => {
  const response = await refresh();
  expect(response.status).toBe(200);
  const session = await sessionStorage.getSession(response.headers.get("Set-Cookie")!.split(";")[0]);
  expect(session.get("user").roles).toEqual(["admin"]);
  expect(session.get("user").passwordHash).toBeUndefined();
  expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: "u1" } });
});

it("also removes obsolete elevated roles", async () => {
  mocks.findUnique.mockResolvedValue({ id: "u1", isActive: true, roles: ["user"] });
  const response = await refresh({ id: "u1", roles: ["superAdmin"] });
  const session = await sessionStorage.getSession(response.headers.get("Set-Cookie")!.split(";")[0]);
  expect(session.get("user").roles).toEqual(["user"]);
});

it("resolves legacy sessions using the signed email", async () => {
  mocks.findFirst.mockResolvedValue({ id: "u1", isActive: true, roles: ["admin"] });
  expect((await refresh({ email: " ADMIN@example.com " })).status).toBe(200);
  expect(mocks.findFirst).toHaveBeenCalledWith({ where: { email: "admin@example.com" } });
});

it.each([{ isActive: false }])("ends sessions for inactive accounts: %s", async (user) => {
  mocks.findUnique.mockResolvedValue(user);
  const response = await refresh();
  expect(response.headers.get("Location")).toBe("/login");
  expect(response.headers.get("Set-Cookie")).toContain("Expires=Thu, 01 Jan 1970");
  expect(mocks.findFirst).not.toHaveBeenCalled();
});

it("requires authentication", async () => {
  expect((await refresh(null)).headers.get("Location")).toBe("/login");
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
it("rejects cross-origin submissions and non-POST requests", async () => {
  expect((await refresh(undefined, { origin: "http://evil.example" })).status).toBe(403);
  expect((await refresh(undefined, { method: "GET" })).status).toBe(405);
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
it("preserves the cookie when the database is unavailable", async () => {
  mocks.findUnique.mockRejectedValue(new Error("private connection info"));
  const response = await refresh();
  expect(response.status).toBe(503);
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(await response.text()).not.toContain("private connection info");
});

it("explains missing account linkage without silently ending the session", async () => {
  mocks.findUnique.mockResolvedValue(null);
  const response = await refresh();
  expect(response.status).toBe(403);
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect((await response.json()).error).toContain("não está vinculado");
});
