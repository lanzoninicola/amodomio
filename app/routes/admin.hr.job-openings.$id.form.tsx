// Página builder do formulário com drag-and-drop

// routes/admin/job-openings/$id/form.tsx

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useParams, Form } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { useState } from "react";
import { DndContext, closestCenter, useSensor, PointerSensor } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// Tipos suportados
const fieldTypes = ["text", "textarea", "select"] as const;
type FieldType = (typeof fieldTypes)[number];

export const loader = async ({ params }: { params: { id: string } }) => {
  const jobId = params.id;
  const job = await prismaClient.hrJobOpening.findUnique({
    where: { id: jobId },
    include: {
      form: {
        include: { fields: true }
      }
    }
  });

  if (!job) throw new Response("Vaga não encontrada", { status: 404 });
  return json({ job });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const jobId = params.id;
  const rawFields = JSON.parse(formData.get("fields") as string);

  let form = await prismaClient.hrJobApplicationForm.findFirst({
    where: { jobOpeningId: jobId },
  });

  if (!form) {
    form = await prismaClient.hrJobApplicationForm.create({
      data: { jobOpeningId: jobId! },
    });
  }

  await prismaClient.hrApplicationField.deleteMany({
    where: { formId: form.id },
  });

  await prismaClient.hrApplicationField.createMany({
    data: rawFields.map((f: any, idx: number) => ({
      formId: form.id,
      label: f.label,
      type: f.type,
      required: f.required,
    })),
  });

  return json({ ok: true });
};

export default function JobFormBuilder() {
  const { job } = useLoaderData<typeof loader>();
  const [fields, setFields] = useState(job.form?.fields || []);

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);
      setFields(arrayMove(fields, oldIndex, newIndex));
    }
  }

  function updateField(index: number, key: string, value: any) {
    setFields(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }

  function addField() {
    setFields(prev => [...prev, {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
    }]);
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Formulário da Vaga: {job.title}</h1>
      <Form method="post">
        <input type="hidden" name="fields" value={JSON.stringify(fields)} />
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((field, index) => (
              <div key={field.id} className="mb-4 border p-3 rounded-md bg-white">
                <Label>Label</Label>
                <Input value={field.label} onChange={e => updateField(index, "label", e.target.value)} />

                <Label className="mt-2">Tipo</Label>
                <select
                  value={field.type}
                  onChange={e => updateField(index, "type", e.target.value)}
                  className="border rounded w-full p-2"
                >
                  {fieldTypes.map(t => <option key={t}>{t}</option>)}
                </select>

                <div className="flex items-center mt-2 gap-2">
                  <Checkbox
                    checked={field.required}
                    onCheckedChange={(v) => updateField(index, "required", !!v)}
                  />
                  <Label>Obrigatório</Label>
                </div>
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <div className="flex gap-4 mt-6">
          <Button type="button" onClick={addField}>Adicionar campo</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </Form>
    </div>
  );
}
