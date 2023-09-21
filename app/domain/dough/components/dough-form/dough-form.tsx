import { Form } from "@remix-run/react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import Fieldset from "~/components/ui/fieldset";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Dough } from "../../dough.model.server";
import TextareaItem from "~/components/primitives/form/textarea-item/textarea-item";
import formatDate from "~/utils/format-date";
import SubmitButton from "~/components/primitives/submit-button/submit-button";

type DoughFormAction = "dough-create" | "dough-update"

interface DoughFormProps {
    dough?: Dough
    action: DoughFormAction
}

export default function DoughForm({ dough, action = "dough-create" }: DoughFormProps) {

    const doughName = `Impasto del ${formatDate(new Date())}`

    return (
        <Form method="post" className="">
            <Fieldset>
                <InputItem type="hidden" name="id" defaultValue={"id"} />
                <Label htmlFor="name" className="flex gap-2 items-center">
                    Nome impasto
                </Label>
                <InputItem type="text" name="name" defaultValue={dough?.name || doughName} />

            </Fieldset>
            <Fieldset>
                <Label htmlFor="name" className="flex gap-2 items-center">
                    Note
                </Label>
                <TextareaItem name="note" defaultValue={dough?.note} ></TextareaItem>
            </Fieldset>
            <Fieldset>
                <Label htmlFor="name" className="flex gap-2 items-center">
                    Temperatura attuale (C°)
                </Label>
                <InputItem type="text" name="currentTemperature" defaultValue={dough?.currentTemperature || 20} />
            </Fieldset>
            <div className="grid grid-cols-2 gap-x-4 my-16">
                <Fieldset>
                    <Label htmlFor="name" className="flex gap-2 items-center">
                        Totale Farina (gr)
                    </Label>
                    <InputItem type="text" name="flourTotalGrams" defaultValue={dough?.flourTotalGrams || 1000} className="text-3xl" required />
                </Fieldset>
                <Fieldset>
                    <Label htmlFor="name" className="flex gap-2 items-center">
                        Idratazione (%)
                    </Label>
                    <InputItem type="text" name="waterTotalPercentage" defaultValue={dough?.waterTotalPercentage || 80} className="text-3xl" required />
                </Fieldset>
            </div>
            <SubmitButton actionName={action} />

        </Form>
    )
}