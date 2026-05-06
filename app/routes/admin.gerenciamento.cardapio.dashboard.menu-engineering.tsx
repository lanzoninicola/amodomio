import { Outlet } from "@remix-run/react";

export default function MenuEngineeringLayout() {
  return (
    <div className="flex flex-col gap-6">
      <Outlet />
    </div>
  );
}
