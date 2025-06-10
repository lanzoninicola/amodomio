// Página de envio/controle de proposta final
import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  return {
    id: params.id,
    status: "PENDING",
    sentAt: new Date().toISOString(),
  };
}

export default function Proposal() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold">Proposta - Candidatura {data.id}</h1>
      <p>Status atual: {data.status}</p>
      <p>Enviado em: {new Date(data.sentAt).toLocaleString()}</p>
      <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded">Marcar como Aceito</button>
    </div>
  );
}