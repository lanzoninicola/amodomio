import { Form } from "@remix-run/react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import Fieldset from "~/components/ui/fieldset";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { CardapioPizzaAlTaglio } from "../../cardapio-pizza-al-taglio.model.server";
import SelectPizzaAlTaglioCategory from "../select-pizza-al-taglio-type/select-pizza-al-taglio-type";

interface FormAddPizzaSliceIntoCardapioProps {
    cardapio: CardapioPizzaAlTaglio,
}


export default function FormAddPizzaSliceIntoCardapio({ cardapio }: FormAddPizzaSliceIntoCardapioProps) {
    return (
        <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold">Adicionar um novo sabor</h4>
            <Form method="post">
                <input type="hidden" name="cardapioId" value={cardapio.id} />
                <div className="flex flex-col gap-2">
                    <Fieldset>
                        <Textarea name="sliceToppings" placeholder="Ingredientes" required
                            className={
                                cn(
                                    `text-lg p-2 placeholder:text-gray-400`,
                                )
                            }
                        />
                    </Fieldset>

                    <Fieldset>
                        <SelectPizzaAlTaglioCategory name={"sliceCategory"} />
                    </Fieldset>

                    <Fieldset>
                        <InputItem type="text"
                            className="text-sm max-w-[150px]" name="sliceQuantity"
                            autoComplete="off"
                            placeholder="Quantidade"
                        />
                    </Fieldset>

                </div>
                <SubmitButton actionName="cardapio-slice-add"
                    idleText="Adicionar Sabor"
                    loadingText="Adicionando..."
                />

            </Form>
        </div>
    )
}