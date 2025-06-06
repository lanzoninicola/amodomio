// index.tsx da listagem de vagas

// routes/admin/job-openings.tsx

import { defer } from "@remix-run/node";
import { Link, Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { Button } from "@/components/ui/button";
import Loading from "~/components/loading/loading";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { HrJobApplication, HrJobOpening } from "@prisma/client";

// Loader executado no servidor antes do componente ser renderizado
// Utiliza defer para enviar o dado jobs como uma Promise
export const loader = async () => {
  const jobs = await prismaIt(prismaClient.hrJobOpening.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { applications: true } }
    }
  }));

  return defer({ jobs: jobs[1] });
}

// Componente principal da página de listagem de vagas
export default function JobOpeningsPage() {
  const { jobs } = useLoaderData<typeof loader>();

  return (
    <div className="p-4">
      {/* Cabeçalho da página com título e botão para criar nova vaga */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Vagas Abertas</h1>
        <Button asChild>
          <Link to="new">Nova Vaga</Link>
        </Button>
      </div>

      {/* Suspense com fallback enquanto carrega os dados */}
      <Suspense fallback={<Loading />}>
        <Await resolve={jobs}>
          {(jobs) => {

            return (
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li key={job.id} className="border p-4 rounded-md bg-white">
                    <Link to={job.id}>
                      <div className="flex justify-between">
                        <div>
                          {/* Título da vaga e status (Ativa/Inativa) */}
                          <h2 className="text-lg font-semibold">{job.title}</h2>
                          <p className="text-sm text-gray-500">
                            {job.isActive ? "Ativa" : "Inativa"}
                          </p>
                        </div>
                        {/* Contador de candidaturas associadas à vaga */}
                        <p className="text-sm">
                          {job._count.applications} candidatura(s)
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }}
        </Await>
      </Suspense>
    </div>
  );
}
