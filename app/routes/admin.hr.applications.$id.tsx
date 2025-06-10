// Página com detalhes da candidatura + observações internas
import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  const applicationId = params.id;
  // Buscar dados da candidatura aqui
  return { id: applicationId, notesInternal: "Notas internas..." };
}

export default function ApplicationDetails() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-2">Candidatura #{data.id}</h1>
      <textarea
        defaultValue={data.notesInternal}
        className="w-full border p-2 rounded"
        rows={6}
      />
    </div>
  );
}