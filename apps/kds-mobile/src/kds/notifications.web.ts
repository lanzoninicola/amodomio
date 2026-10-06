import { desktop } from "../platform/desktop";
export async function prepareNotifications() {
  /* Desktop permissions belong to the OS. */
}
export async function notifyNewOrders(numbers: Array<number | null>) {
  try {
    await desktop?.notify(numbers);
  } catch {
    /* Notifications must not interrupt polling. */
  }
}
