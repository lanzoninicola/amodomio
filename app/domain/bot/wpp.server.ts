let cachedToken: string | null = null;

const env = process.env;

const SESSION = process.env.WPP_SESSION || "amodomio";
const BASE_URL =
  env.NODE_ENV === "development" ? env.WPP_BASE_URL_DEV : env.WPP_BASE_URL;
const SECRET = process.env.WPP_SECRET || "THISISMYSECURETOKEN";

function baseUrl() {
  const u = BASE_URL;
  if (!u) throw new Error("WPP_BASE_URL ausente");
  return u.replace(/\/+$/, "");
}

async function generateToken(): Promise<string> {
  const session = SESSION;
  const secret = SECRET;

  console.log({ session, secret, baseUrl: baseUrl() });

  const res = await fetch(
    `${baseUrl()}/api/${encodeURIComponent(session)}/${encodeURIComponent(
      secret
    )}/generate-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok)
    throw new Error(`Falha ao gerar token: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json?.token as string; // use o campo 'token' (sem o prefixo)
}

async function authedFetch(path: string, init?: RequestInit, retry = true) {
  if (!cachedToken) cachedToken = await generateToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cachedToken}`,
      ...(init?.headers || {}),
    },
  });

  // Se 401, regenera o token e tenta 1x novamente
  if (res.status === 401 && retry) {
    cachedToken = await generateToken();
    return authedFetch(path, init, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WPP API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

export async function sendText(
  session: string,
  phone: string,
  message: string
) {
  try {
    return await authedFetch(
      `/api/${encodeURIComponent(session)}/send-message`,
      {
        method: "POST",
        body: JSON.stringify({ phone, message }),
      }
    );
  } catch {
    // fallback para variantes { number, text }
    return await authedFetch(
      `/api/${encodeURIComponent(session)}/send-message`,
      {
        method: "POST",
        body: JSON.stringify({ number: phone, text: message }),
      }
    );
  }
}

export async function ensureSession(session: string) {
  try {
    return await authedFetch(`/api/${encodeURIComponent(session)}/status`);
  } catch {
    return await authedFetch(
      `/api/${encodeURIComponent(session)}/start-session`,
      {
        method: "POST",
        body: JSON.stringify({ session }),
      }
    );
  }
}
