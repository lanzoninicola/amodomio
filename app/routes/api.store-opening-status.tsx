import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getStoreOpeningStatus } from "~/domain/store-opening/store-opening-status.server";

export async function loader({}: LoaderFunctionArgs) {
  const { status } = await getStoreOpeningStatus();
  return json({
    ...status,
    timestamp: new Date().toISOString(),
  });
}
