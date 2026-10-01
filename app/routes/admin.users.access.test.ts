import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ isAuthenticated: vi.fn(), findMany: vi.fn(), saveUser: vi.fn() }));
vi.mock("~/domain/auth/google.server", () => ({ authenticator: { isAuthenticated: mocks.isAuthenticated } }));
vi.mock("~/lib/prisma/client.server", () => ({ default: { userAccess: { findMany: mocks.findMany } } }));
vi.mock("~/domain/auth/user-access.server", () => ({
  getLegacyWhitelistedEmails: () => [],
  createOrUpdateManagedUser: mocks.saveUser,
  hasAnyRole: (user: { roles: string[] }, roles: string[]) => user.roles.some(role => roles.includes(role)),
}));
import { action, loader } from "./admin.users";
const load = () => loader({ request: new Request("http://localhost/admin/users"), params: {}, context: {} });
beforeEach(() => vi.resetAllMocks());
it("shows a support-ready 403 instead of redirecting a signed-in user", async () => {
  mocks.isAuthenticated.mockResolvedValue({ email: "person@example.com", roles: [] });
  const response = await load().catch(error => error);
  expect(response.status).toBe(403);
  expect(response.headers.get("Location")).toBeNull();
  expect(await response.json()).toEqual({ code: "USERS_ACCESS_DENIED", email: "person@example.com" });
  expect(mocks.findMany).not.toHaveBeenCalled();
});
it("redirects unauthenticated visitors to login", async () => {
  mocks.isAuthenticated.mockResolvedValue(null);
  expect((await load()).headers.get("Location")).toBe("/login");
  expect(mocks.findMany).not.toHaveBeenCalled();
});
it("keeps the user list accessible to administrators", async () => {
  mocks.isAuthenticated.mockResolvedValue({ email: "admin@example.com", roles: ["admin"] });
  mocks.findMany.mockResolvedValue([]);
  expect((await load()).status).toBe(200);
  expect(mocks.findMany).toHaveBeenCalledOnce();
});

it.each(["kdsOperator", "kdsAdmin"])("preserves %s when saving a managed user", async (role) => {
  mocks.isAuthenticated.mockResolvedValue({ email: "admin@example.com", roles: ["admin"] });
  mocks.saveUser.mockResolvedValue({ id: "managed-user" });
  const form = new FormData();
  form.set("_intent", "save-user");
  form.set("username", "kds-test");
  form.append("roles", role);
  const response = await action({
    request: new Request("http://localhost/admin/users", { method: "POST", body: form }),
    params: {}, context: {},
  });
  expect(response.status).toBe(302);
  expect(mocks.saveUser).toHaveBeenCalledWith(expect.objectContaining({ roles: [role] }));
});
