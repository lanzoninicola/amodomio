import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pool: vi.fn(),
  adapter: vi.fn(),
  client: vi.fn(),
}));

vi.mock("pg", () => ({ Pool: class { constructor(options: unknown) { mocks.pool(options); } } }));
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class { constructor(...args: unknown[]) { mocks.adapter(...args); } },
}));
vi.mock("@prisma/client", () => ({
  PrismaClient: class { constructor(options: unknown) { mocks.client(options); } },
}));

const globals = globalThis as typeof globalThis & { ammPrismaClient?: unknown };

afterEach(() => {
  delete globals.ammPrismaClient;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

it("reuses the client and bounded pool after development module reloads", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PRISMA_DB_DEV_URL", "postgresql://localhost/development");

  const first = (await import("./client.server")).default;
  vi.resetModules();
  const reloaded = (await import("./client.server")).default;

  expect(reloaded).toBe(first);
  expect(mocks.client).toHaveBeenCalledTimes(1);
  expect(mocks.pool).toHaveBeenCalledTimes(1);
  expect(mocks.pool).toHaveBeenCalledWith({
    connectionString: "postgresql://localhost/development",
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  expect(mocks.adapter).toHaveBeenCalledWith(expect.anything(), { disposeExternalPool: true });
  expect(first.dbName).toBe("development");
});
