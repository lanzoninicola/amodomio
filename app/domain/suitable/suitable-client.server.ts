const BASE = () => process.env.SUITABLE_API_URL || "https://api.suit.com.br";

let cached: { token: string; exp: number } | null = null;

export async function getSuitableToken(): Promise<string> {
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token;
  const id = process.env.SUITABLE_CLIENT_ID;
  const secret = process.env.SUITABLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SUITABLE_CLIENT_ID/SECRET ausentes");
  const res = await fetch(`${BASE()}/api/auth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials&scope=order",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Suitable auth falhou (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export type SuitableOrderDetails = {
  id: number;
  display_number?: string | null;
  status: string;
  order_type?: string | null;
  source?: string | null;
  paid: boolean;
  comments?: string | null;
  delivery_fee: string;
  discount: string;
  total: string;
  customer?: { name?: string | null; phone?: string | null } | null;
  delivery_address?: { formatted: string } | null;
  items: Array<{
    name: string;
    category?: string | null;
    quantity: number;
    comments?: string | null;
    options: Array<{ group_name?: string | null; name: string; quantity: number }>;
  }>;
  payment: {
    paid: boolean;
    change_for?: string | null;
    methods: Array<{ type?: string | null; name?: string | null; value: string }>;
  };
};

export async function fetchSuitableOrder(
  orderId: number
): Promise<SuitableOrderDetails> {
  const res = await fetch(`${BASE()}/api/order/details/?order_id=${orderId}`, {
    headers: { Authorization: `Bearer ${await getSuitableToken()}` },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401) cached = null;
  if (!res.ok) throw new Error(`Suitable order ${orderId} falhou (${res.status})`);
  return (await res.json()) as SuitableOrderDetails;
}
