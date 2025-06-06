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
import { ok } from "node:assert";
import JobOpeningForm from "~/domain/hr/components/job-opening-form";

// 🚀 Carrega funções disponíveis
export async function loader({ }: LoaderFunctionArgs) {
  const functions = await prismaIt(prismaClient.hrJobFunction.findMany({
    orderBy: { name: "asc" },
  }))
  return defer({ functions: functions[1] })
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

  if (_action === "vaga-new") {
    await prismaClient.hrJobOpening.create({
      data: {
        title,
        isActive,
        functionId,
        description,
        financeProposalByConsultant,
        financeProposalToOffer,
        note
      },
    },
    );

    return ok("Vaga criada com sucesso");
  }

  return null

}

// 🖼️ Componente
export default function NewJobOpening() {

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [description, setDescription] = useState("");
  const { functions } = useLoaderData<typeof loader>();

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Nova Vaga</h1>

      <JobOpeningForm
        action={"vaga-new"}
        functions={functions || []}

      />
    </div>
  );
}
