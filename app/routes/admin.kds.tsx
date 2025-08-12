import { Link, Outlet } from "@remix-run/react";


export default function AdminKdsLayout() {
  return (
    <div className="flex flex-col gap-4">

      <Outlet />
    </div>
  )
}