import { Form } from "@remix-run/react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import Fieldset from "~/components/ui/fieldset"
import { Textarea } from "~/components/ui/textarea"
import SelectPizzaAlTaglioCategory from "~/domain/cardapio-pizza-al-taglio/components/select-pizza-al-taglio-type/select-pizza-al-taglio-type"
import { cn } from "~/lib/utils"

export default function FormAddPizzaSlice() {
    return (
        <Form method="post">
            <div className="flex flex-col gap-2">
                <Fieldset>
                    <Textarea name="toppings" placeholder="Ingredientes" required
                        className={
                            cn(
                                `text-lg p-2 placeholder:text-gray-400`,
                            )
                        }
                    />
                </Fieldset>

                <Fieldset>
                    <SelectPizzaAlTaglioCategory name={"category"} />
                </Fieldset>

            </div>
            <SubmitButton actionName="add-pizza-al-taglio"
                idleText="Salvar"
                loadingText="Salvando..."
            />

        </Form>
    )
}

