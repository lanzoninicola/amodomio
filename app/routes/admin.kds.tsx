import { Link, Outlet } from "@remix-run/react";


export default function AdminKdsLayout() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between">
        <Link to="atendimento">
          <span className="text-[12px] underline uppercase tracking-wider">Atendimento</span>
        </Link>
        <Link to="cozinha">
          <span className="text-[12px] underline uppercase tracking-wider">Cozinha</span>
        </Link>
      </div>
      <Outlet />
    </div>
  )
}