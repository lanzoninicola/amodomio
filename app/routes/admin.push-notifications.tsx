import { Outlet } from "@remix-run/react";

export default function AdminPushNotificationsLayout() {
  return (
    <div className="max-w-6xl space-y-6">
      <Outlet />
    </div>
  );
}
