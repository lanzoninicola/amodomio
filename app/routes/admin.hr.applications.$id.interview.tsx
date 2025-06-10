// Página de agendamento da entrevista

import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  return {
    id: params.id,
    status: "PROPOSED",
    proposedDate: new Date().toISOString(),
  };
}

export default function InterviewPage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold">Entrevista - Candidatura {data.id}</h1>
      <p>Status: {data.status}</p>
      <p>Data proposta: {new Date(data.proposedDate).toLocaleString()}</p>
      <input type="datetime-local" className="border mt-4 p-2" />
    </div>
  );
}