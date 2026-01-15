import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  getStoreOpeningStatus,
  setStoreOpeningOverride,
  type StoreOpeningOverride,
} from "~/domain/store-opening/store-opening-status.server";

export async function loader({}: LoaderFunctionArgs) {
  const { status, override } = await getStoreOpeningStatus();
  return json({
    ...status,
    override,
    timestamp: new Date().toISOString(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const override = String(form.get("override") || "auto").toLowerCase();

  if (override !== "auto" && override !== "open" && override !== "closed") {
    return json({ ok: false, error: "invalid_override" }, { status: 400 });
  }

  await setStoreOpeningOverride(override as StoreOpeningOverride);
  return json({ ok: true, override });
}
