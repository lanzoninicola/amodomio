// index.tsx da listagem pública de vagas

// routes/jobs/_index.tsx

import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";

export const loader = async () => {
  const jobs = await prismaClient.hrJobOpening.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return json({ jobs });
};

export default function JobListPage() {
  const { jobs } = useLoaderData<typeof loader>();

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Vagas Disponíveis</h1>
      <ul className="space-y-4">
        {jobs.map((job) => (
          <li key={job.id} className="border rounded-md p-4 bg-white">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">{job.title}</h2>
                <p className="text-sm text-gray-500">
                  Publicada em {new Date(job.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Link
                to={`/jobs/${job.id}/apply`}
                className="text-blue-600 underline text-sm"
              >
                Candidatar-se
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
