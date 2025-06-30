import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Await, defer, Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Suspense, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TiptapEditor from "~/components/tiptap-editor/tiptap-editor";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import Loading from "~/components/loading/loading";
import JobOpeningForm from "~/domain/hr/components/job-opening-form";
import { badRequest, ok } from "~/utils/http-response.server";
import { a } from "vitest/dist/suite-BWgaIsVn.js";

// 🚀 Carrega funções disponíveis
export async function loader({ params }: LoaderFunctionArgs) {

  const jobId = params.id;

  if (!jobId) {
    badRequest("Job ID não fornecido");
  }

  const functions = await prismaIt(prismaClient.hrJobFunction.findMany({
    orderBy: { name: "asc" },
  }))

  const jobOpening = await prismaIt(prismaClient.hrJobOpening.findFirst({
    where: { id: jobId }, // Substitua por um ID válido ou lógica para obter a vaga
    include: {
      function: true,
    },
  }));
  if (!jobOpening) {
    badRequest("Vaga não encontrada");
  }

  return defer({ functions: functions[1], jobOpening: jobOpening[1] });
}

// 💾 Criação da vaga
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const _action = formData.get("_action") as string
  const title = formData.get("title") as string;
  const isActive = formData.get("isActive") === "on";
  const description = formData.get("description") as string;
  const functionId = formData.get("functionId") as string;
  const financeProposalByConsultant = formData.get("financeProposalByConsultant") as string
  const financeProposalToOffer = formData.get("financeProposalToOffer") as string
  const note = formData.get("note") as string

  if (!title || !description || !functionId) {
    return json({ error: "Todos os campos são obrigatórios." }, { status: 400 });
  }

  console.log({ action: _action, title, isActive, functionId, description, financeProposalByConsultant, financeProposalToOffer, note });

  if (_action === "vaga-edit") {
    // await prismaClient.hrJobOpening.update({
    //   data: {
    //     title,
    //     isActive,
    //     functionId,
    //     description,
    //     financeProposalByConsultant,
    //     financeProposalToOffer,
    //     note
    //   },
    // },
    // );

    return ok("Vaga atualizada com sucesso");
  }

  return null

}

// 🖼️ Componente
export default function NewJobOpening() {

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [description, setDescription] = useState("");
  const data = useLoaderData<typeof loader>();

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold tracking-tight mb-4">
        {
          data.jobOpening ? `Editar Vaga: ${data.jobOpening.title}` : "Nova Vaga"
        }
      </h1>

      <Suspense fallback={<Loading />}>
        <Await resolve={{ functions: data.functions, jobOpening: data.jobOpening }}>
          {({ functions, jobOpening }) => {

            return (
              <JobOpeningForm
                action={"vaga-edit"}
                functions={functions || []}
                // @ts-ignore
                jobOpening={jobOpening}

              />
            )
          }
          }
        </Await>
      </Suspense>
    </div>
  );
}
