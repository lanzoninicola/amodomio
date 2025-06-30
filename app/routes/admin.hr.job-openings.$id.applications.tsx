// Lista de candidaturas recebidas por vaga

import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";

export const loader = async ({ params }: { params: { id: string } }) => {
  const job = await prismaClient.hrJobOpening.findUnique({
    where: { id: params.id },
    include: {
      applications: {
        include: { answers: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) throw new Response("Vaga não encontrada", { status: 404 });
  return json({ job });
};

export default function JobApplicationsPage() {
  const { job } = useLoaderData<typeof loader>();

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Candidaturas: {job.title}</h1>
      <ul className="space-y-4">
        {job.applications.map((app) => (
          <li key={app.id} className="border p-4 rounded-md bg-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">
                  Candidatado em {new Date(app.createdAt).toLocaleDateString("pt-BR")}
                </p>
                <ul className="text-sm mt-2 list-disc list-inside text-gray-700">
                  {app.answers.map(ans => (
                    <li key={ans.id}><strong>{ans.fieldLabel}:</strong> {ans.answer}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {app.status}
                </span>
              </div>
            </div>
          </li>
        ))}
        {job.applications.length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma candidatura ainda.</p>
        )}
      </ul>
    </div>
  );
}
