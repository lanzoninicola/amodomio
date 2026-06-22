import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createCookieSessionStorage } from "@remix-run/node";
import { AUTH_COOKIE_SECRET } from "~/domain/auth/constants.server";
import prismaClient from "~/lib/prisma/client.server";

const DEFAULT_GRAPH_API_VERSION = "v25.0";
const OAUTH_STATE_KEY = "state";
const TOKEN_ALGORITHM = "aes-256-gcm";

type InstagramAccount = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

type FacebookPage = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: InstagramAccount;
};

type GraphListResponse<T> = {
  data?: T[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

function requiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function graphApiVersion() {
  return String(process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION)
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function graphUrl(pathname: string) {
  return `https://graph.facebook.com/${graphApiVersion()}/${pathname.replace(
    /^\/+/,
    ""
  )}`;
}

function tokenEncryptionKey() {
  return createHash("sha256")
    .update(requiredEnv("META_TOKEN_ENCRYPTION_SECRET"))
    .digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(TOKEN_ALGORITHM, tokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
}

function decryptToken(payload: string) {
  const [ivValue, authTagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Token criptografado inválido.");
  }

  const decipher = createDecipheriv(
    TOKEN_ALGORITHM,
    tokenEncryptionKey(),
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const oauthSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "meta_oauth_state",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    secrets: [
      String(
        process.env.META_OAUTH_COOKIE_SECRET ||
          AUTH_COOKIE_SECRET ||
          process.env.META_TOKEN_ENCRYPTION_SECRET ||
          "amodomio-meta-oauth"
      ),
    ],
  },
});

async function readGraphJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok || payload?.error) {
    const message =
      payload?.error?.message ||
      `A Meta respondeu com HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

export function getInstagramFacebookConfig() {
  const appId = String(process.env.META_APP_ID || "").trim();
  const appSecretConfigured = Boolean(
    String(process.env.META_APP_SECRET || "").trim()
  );
  const callbackUrl = String(
    process.env.META_FACEBOOK_CALLBACK_URL || ""
  ).trim();
  const encryptionConfigured = Boolean(
    String(process.env.META_TOKEN_ENCRYPTION_SECRET || "").trim()
  );

  return {
    appId,
    appSecretConfigured,
    callbackUrl,
    encryptionConfigured,
    configId: String(process.env.META_FACEBOOK_LOGIN_CONFIG_ID || "").trim(),
    facebookPageId: String(process.env.META_FACEBOOK_PAGE_ID || "").trim(),
    graphApiVersion: graphApiVersion(),
    ready:
      Boolean(appId) &&
      appSecretConfigured &&
      Boolean(callbackUrl) &&
      encryptionConfigured,
  };
}

export async function createInstagramFacebookLogin(request: Request) {
  const appId = requiredEnv("META_APP_ID");
  const callbackUrl = requiredEnv("META_FACEBOOK_CALLBACK_URL");
  requiredEnv("META_APP_SECRET");
  requiredEnv("META_TOKEN_ENCRYPTION_SECRET");

  const state = randomBytes(32).toString("hex");
  const session = await oauthSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  session.set(OAUTH_STATE_KEY, state);

  const authorizationUrl = new URL(
    `https://www.facebook.com/${graphApiVersion()}/dialog/oauth`
  );
  authorizationUrl.searchParams.set("client_id", appId);
  authorizationUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set(
    "scope",
    [
      "instagram_basic",
      "instagram_content_publish",
      "pages_read_engagement",
      "pages_show_list",
      "business_management",
    ].join(",")
  );

  const configId = String(
    process.env.META_FACEBOOK_LOGIN_CONFIG_ID || ""
  ).trim();
  if (configId) {
    authorizationUrl.searchParams.set("config_id", configId);
    authorizationUrl.searchParams.set("override_default_response_type", "true");
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    setCookie: await oauthSessionStorage.commitSession(session),
  };
}

export async function validateInstagramFacebookState(
  request: Request,
  receivedState: string
) {
  const session = await oauthSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const expectedState = String(session.get(OAUTH_STATE_KEY) || "");
  const clearCookie = await oauthSessionStorage.destroySession(session);

  const expectedBuffer = Buffer.from(expectedState);
  const receivedBuffer = Buffer.from(receivedState);
  const valid =
    expectedBuffer.length > 0 &&
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);

  return { valid, clearCookie };
}

async function exchangeAuthorizationCode(code: string) {
  const params = new URLSearchParams({
    client_id: requiredEnv("META_APP_ID"),
    client_secret: requiredEnv("META_APP_SECRET"),
    redirect_uri: requiredEnv("META_FACEBOOK_CALLBACK_URL"),
    code,
  });
  const shortResponse = await fetch(
    `${graphUrl("oauth/access_token")}?${params.toString()}`
  );
  const shortToken = await readGraphJson<{
    access_token: string;
    token_type?: string;
    expires_in?: number;
  }>(shortResponse);

  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: requiredEnv("META_APP_ID"),
    client_secret: requiredEnv("META_APP_SECRET"),
    fb_exchange_token: shortToken.access_token,
  });
  const longResponse = await fetch(
    `${graphUrl("oauth/access_token")}?${longParams.toString()}`
  );
  return readGraphJson<{
    access_token: string;
    token_type?: string;
    expires_in?: number;
  }>(longResponse);
}

async function listInstagramPages(accessToken: string) {
  const params = new URLSearchParams({
    fields:
      "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
    limit: "100",
    access_token: accessToken,
  });
  const response = await fetch(
    `${graphUrl("me/accounts")}?${params.toString()}`
  );
  const payload = await readGraphJson<GraphListResponse<FacebookPage>>(
    response
  );
  return (payload.data || []).filter(
    (page) => page.instagram_business_account?.id
  );
}

export async function connectInstagramFromAuthorizationCode(code: string) {
  const token = await exchangeAuthorizationCode(code);
  const pages = await listInstagramPages(token.access_token);
  const configuredPageId = String(
    process.env.META_FACEBOOK_PAGE_ID || ""
  ).trim();
  const selectedPages = configuredPageId
    ? pages.filter((page) => page.id === configuredPageId)
    : pages;

  if (selectedPages.length === 0) {
    throw new Error(
      configuredPageId
        ? "A Página configurada em META_FACEBOOK_PAGE_ID não foi autorizada ou não possui Instagram profissional vinculado."
        : "Nenhuma Página com conta profissional do Instagram vinculada foi encontrada."
    );
  }
  if (selectedPages.length > 1) {
    throw new Error(
      "Mais de uma Página com Instagram foi encontrada. Configure META_FACEBOOK_PAGE_ID com a Página da A Modo Mio e tente novamente."
    );
  }

  const page = selectedPages[0];
  const instagram = page.instagram_business_account!;
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000)
    : null;

  return prismaClient.instagramConnection.upsert({
    where: { provider: "facebook" },
    create: {
      provider: "facebook",
      facebookPageId: page.id,
      facebookPageName: page.name,
      instagramAccountId: instagram.id,
      instagramUsername: instagram.username || null,
      encryptedAccessToken: encryptToken(token.access_token),
      tokenExpiresAt: expiresAt,
      status: "connected",
      lastVerifiedAt: new Date(),
      lastError: null,
    },
    update: {
      facebookPageId: page.id,
      facebookPageName: page.name,
      instagramAccountId: instagram.id,
      instagramUsername: instagram.username || null,
      encryptedAccessToken: encryptToken(token.access_token),
      tokenExpiresAt: expiresAt,
      status: "connected",
      lastVerifiedAt: new Date(),
      lastError: null,
    },
  });
}

export async function getInstagramConnection() {
  return prismaClient.instagramConnection.findUnique({
    where: { provider: "facebook" },
    select: {
      id: true,
      provider: true,
      facebookPageId: true,
      facebookPageName: true,
      instagramAccountId: true,
      instagramUsername: true,
      tokenExpiresAt: true,
      status: true,
      lastVerifiedAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function verifyInstagramConnection() {
  const connection = await prismaClient.instagramConnection.findUnique({
    where: { provider: "facebook" },
  });
  if (!connection) throw new Error("Instagram ainda não está conectado.");

  try {
    const token = decryptToken(connection.encryptedAccessToken);
    const params = new URLSearchParams({
      fields: "id,username,name",
      access_token: token,
    });
    const response = await fetch(
      `${graphUrl(connection.instagramAccountId)}?${params.toString()}`
    );
    const account = await readGraphJson<InstagramAccount>(response);

    return prismaClient.instagramConnection.update({
      where: { id: connection.id },
      data: {
        instagramUsername:
          account.username || connection.instagramUsername || null,
        status: "connected",
        lastVerifiedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao validar conexão.";
    await prismaClient.instagramConnection.update({
      where: { id: connection.id },
      data: {
        status: "error",
        lastVerifiedAt: new Date(),
        lastError: message,
      },
    });
    throw error;
  }
}

export async function disconnectInstagram() {
  return prismaClient.instagramConnection.deleteMany({
    where: { provider: "facebook" },
  });
}
