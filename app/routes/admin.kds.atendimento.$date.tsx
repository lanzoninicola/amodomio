// app/routes/admin.kds.atendimento.$date.tsx
import { Outlet } from "@remix-run/react";

export default function AtendimentoDateLayout() {
  return (
    <div className="min-h-screen">
      {/* Se quiser uma barra comum às duas visões, coloque aqui */}
      <Outlet />
    </div>
  );
}
