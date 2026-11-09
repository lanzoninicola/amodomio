import { createHmac, timingSafeEqual } from "node:crypto";
import { createCookieSessionStorage } from "@remix-run/node";
import { AUTH_COOKIE_SECRET } from "./constants.server";
import type { LoggedUser } from "./types.server";

const secret = AUTH_COOKIE_SECRET || "AM0D0MI02O24";
const TOKEN_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_S = 8 * 60 * 60;
export const EMBED_USER_EMAIL = "suitable-extension";
const EMBED_USER: NonNullable<LoggedUser> = {
  name: "Extensão Suitable",
  email: EMBED_USER_EMAIL,
  avatarURL: "",
  roles: [],
};

export const EMBED_COOKIE_NAME = "__embed_stock";

const embedStorage = createCookieSessionStorage({
  cookie: {
    name: EMBED_COOKIE_NAME,
    httpOnly: true,
    // Cross-site iframe inside Suitable: needs None + Secure + Partitioned.
    sameSite: "none",
    secure: true,
    secrets: [secret],
    maxAge: SESSION_TTL_S,
  },
});

function sign(batchId: string, expires: number) {
  return createHmac("sha256", secret)
    .update(`embed-stock:${batchId}:${expires}`)
    .digest("hex");
}

export function createEmbedToken(batchId: string) {
  const expires = Date.now() + TOKEN_TTL_MS;
  return `${expires}.${sign(batchId, expires)}`;
}

export function verifyEmbedToken(batchId: string, token: string | null) {
  const [expiresText, signature = ""] = String(token || "").split(".");
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(batchId, expires));
  const received = Buffer.from(signature);
  return (
    expected.length === received.length &&
    timingSafeEqual(new Uint8Array(expected), new Uint8Array(received))
  );
}

export function embedCookiePath(batchId: string) {
  return `/admin/import-stock-movements/${encodeURIComponent(batchId)}`;
}

// API routes called by the batch screen (fetcher posts outside the batch path).
const EMBED_API_PATHS = ["/api/admin-stock-import-batch-import-step"];

/** Set-Cookie values for the iframe session, limited to the batch screen paths. */
export async function commitEmbedSession(batchId: string) {
  const session = await embedStorage.getSession();
  session.set("batchId", batchId);
  session.set("expires", Date.now() + SESSION_TTL_S * 1000);
  return Promise.all(
    [embedCookiePath(batchId), ...EMBED_API_PATHS].map(
      async (path) =>
        `${await embedStorage.commitSession(session, { path })}; Partitioned`
    )
  );
}

async function readEmbedBatchId(cookieHeader: string | null) {
  if (!cookieHeader?.includes(EMBED_COOKIE_NAME)) return null;
  const session = await embedStorage.getSession(cookieHeader);
  const batchId = session.get("batchId");
  const expires = Number(session.get("expires"));
  if (!batchId || !Number.isFinite(expires) || expires < Date.now())
    return null;
  return String(batchId);
}

export async function readEmbedUser(
  cookieHeader: string | null
): Promise<LoggedUser> {
  return (await readEmbedBatchId(cookieHeader)) ? EMBED_USER : null;
}

/** True when the request may act on this batch (normal login, or an embed session for the same batch). */
export async function embedSessionAllowsBatch(
  user: LoggedUser,
  cookieHeader: string | null,
  batchId: string
) {
  if (!user || user.email !== EMBED_USER_EMAIL) return true;
  return (await readEmbedBatchId(cookieHeader)) === batchId;
}
