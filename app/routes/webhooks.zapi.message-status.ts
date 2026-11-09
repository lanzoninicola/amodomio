import type { ActionFunctionArgs } from "@remix-run/node";
import { handleConfirmationWebhook } from "~/domain/z-api/confirmation-webhook.server";
export const action = ({ request }: ActionFunctionArgs) =>
  handleConfirmationWebhook(request, "message-status");
