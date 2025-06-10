// apply.tsx do formulário dinâmico

// routes/jobs/$id/apply.tsx

import { json, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const loader = async ({ params }: { params: { id: string } }) => {
  const job = await prismaClient.hrJobOpening.findUnique({
    where: { id: params.id },
    include: {
      form: {
        include: { fields: true }
      },
      description: true,
    }
  });

  if (!job || !job.isActive) throw new Response("Vaga não encontrada", { status: 404 });
  return json({ job });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const jobId = params.id;

  const job = await prismaClient.hrJobOpening.findUnique({
    where: { id: jobId },
    include: { form: true },
  });
  if (!job || !job.form) throw new Response("Vaga ou formulário inválido", { status: 400 });

  const fields = await prismaClient.hrApplicationField.findMany({
    where: { formId: job.form.id },
  });

  const application = await prismaClient.hrJobApplication.create({
    data: {
      jobOpeningId: jobId!,
    },
  });

  await Promise.all(
    fields.map((field) => {
      const answer = formData.get(field.label);
      return prismaClient.hrApplicationAnswer.create({
        data: {
          applicationId: application.id,
          fieldLabel: field.label,
          answer: String(answer || ""),
        },
      });
    })
  );

  return redirect("/jobs/success");
};

export default function JobApplicationPage() {
  const { job } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{job.title}</h1>
      <div
        className="prose mb-6"
        dangerouslySetInnerHTML={{ __html: job?.description?.htmlContent || "" }}
      />
      <Form method="post">
        {job.form?.fields.map((field) => (
          <div key={field.id} className="mb-4">
            <Label htmlFor={field.label}>{field.label}{field.required && ' *'}</Label>
            {field.type === "textarea" ? (
              <Textarea name={field.label} id={field.label} required={field.required} />
            ) : (
              <Input name={field.label} id={field.label} required={field.required} />
            )}
          </div>
        ))}

        {actionData?.error && (
          <p className="text-sm text-red-600 mb-2">{actionData.error}</p>
        )}

        <Button type="submit" disabled={navigation.state !== "idle"}>
          Enviar candidatura
        </Button>
      </Form>
    </div>
  );
}
