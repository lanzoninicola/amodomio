import { HrJobFunction, HrJobOpening } from "@prisma/client"

import { Form, Await } from "@remix-run/react"
import React, { Suspense, useState } from "react"
import { Button } from "react-day-picker"
import { FormLabel } from "~/components/layout/form"
import Loading from "~/components/loading/loading"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import TiptapEditor from "~/components/tiptap-editor/tiptap-editor"
import { Checkbox } from "~/components/ui/checkbox"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { jsonStringify } from "~/utils/json-helper"

export interface JobOpeningProp extends HrJobOpening {
  function: HrJobFunction
}


interface JobOpeningFormProps {
  functions: HrJobFunction[],
  jobOpening?: JobOpeningProp | null,
  action: "vaga-new" | "vaga-edit"
}

export default function JobOpeningForm({ functions, jobOpening, action }: JobOpeningFormProps) {

  const [description, setDescription] = useState(jobOpening?.description || "");
  const [financeProposalByConsultant, setFinanceProposalByConsultant] = useState(jobOpening?.financeProposalByConsultant || "")
  const [financeProposalToOffer, setFinanceProposalToOffer] = useState(jobOpening?.financeProposalToOffer || "")


  const LabelForm = ({ children, ...props }: {
    children: React.ReactNode,
  } & React.ComponentPropsWithoutRef<typeof Label>) => (
    <FormLabel className="font-semibold text-sm mb-4" {...props}>{children}</FormLabel>
  );

  return (
    <Form method="post">
      {/* Título */}
      <section className="mb-6">
        <LabelForm htmlFor="title">Título da vaga</LabelForm>
        <Input name="title" id="title" required defaultValue={jobOpening?.title} />
      </section>



      <section className="mb-6">
        <LabelForm htmlFor="functionId">Função</LabelForm>
        <Select name="functionId" required defaultValue={jsonStringify(jobOpening?.function)} >
          <SelectTrigger className="w-[350px]">
            <SelectValue placeholder="Selecione a função" />
          </SelectTrigger>
          <SelectContent>
            {functions.map((fn) => (
              <SelectItem key={fn.id} value={JSON.stringify(fn)}>
                {fn.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>



      {/* Descrição */}
      <div className="mb-6">
        <LabelForm className="font-semibold text-sm">Descrição da vaga</LabelForm>
        <input type="hidden" name="description" value={description} />
        <TiptapEditor content={jobOpening?.description || ""} onChange={setDescription} />
      </div>

      {/* Status */}
      <div className="mb-6 flex items-center gap-2">
        <Checkbox id="isActive" name="isActive" defaultChecked />
        <LabelForm htmlFor="isActive" className="font-semibold text-sm">Vaga ativa</LabelForm>
      </div>

      <Separator className="my-4" />

      <section className="mb-6">
        <LabelForm>Offerta publica</LabelForm>
        <input type="hidden" name="financeProposalToOffer" value={financeProposalToOffer} />
        <TiptapEditor content={jobOpening?.financeProposalToOffer || ""} onChange={setFinanceProposalToOffer} />
      </section>

      <Separator className="my-4" />

      <section className="bg-slate-50 p-4 rounded-md mb-6">
        <h2 className="font-semibold mb-6">Informações privadas</h2>
        <div className="mb-6">
          <LabelForm >Offerta recebida pelo escritorio de RH</LabelForm>
          <input type="hidden" name="financeProposalByConsultant" value={financeProposalByConsultant} />
          <TiptapEditor content={jobOpening?.financeProposalByConsultant || ""} onChange={setFinanceProposalByConsultant} />
        </div>
      </section>






      <SubmitButton actionName={action}>
        Salvar
      </SubmitButton>
    </Form>
  )
}