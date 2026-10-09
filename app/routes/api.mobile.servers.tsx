import { json } from "@remix-run/node";
import { readServerPresets } from "~/domain/mobile/server-presets.server";

// Public bootstrap configuration, available before login. No other settings exposed.
export async function loader() {
  return json(
    { servers: await readServerPresets() },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    }
  );
}
