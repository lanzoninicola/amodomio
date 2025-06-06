// Página de sucesso após envio de candidatura

// routes/jobs/success.tsx

import { Link } from "@remix-run/react";
import { Button } from "@/components/ui/button";

export default function JobSuccessPage() {
  return (
    <div className="p-6 max-w-lg mx-auto text-center">
      <h1 className="text-2xl font-bold mb-4">Candidatura enviada com sucesso!</h1>
      <p className="mb-6">Agradecemos seu interesse. Em breve entraremos em contato caso seu perfil seja selecionado.</p>
      <Button asChild>
        <Link to="/jobs">Ver outras vagas</Link>
      </Button>
    </div>
  );
}
