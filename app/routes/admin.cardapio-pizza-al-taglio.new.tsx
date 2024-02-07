
import { ActionArgs } from "@remix-run/node";
import { useActionData } from "@remix-run/react";

import { toast } from "~/components/ui/use-toast";
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server";
import { SliceTaglio, SliceTaglioCategory } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server";
import CardapioPizzaAlTaglioForm from "~/domain/cardapio-pizza-al-taglio/components/cardapio-pizza-al-taglio-form/cardapio-pizza-al-taglio-form";
import queryIt from "~/lib/atlas-mongodb/query-it.server";
import { badRequest, serverError, ok } from "~/utils/http-response.server";

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "cardapio-create") {

        const toppingNumbers = Number(values?.toppingNumbers) || 1
        const slices: SliceTaglio[] = []

        Array.from({ length: toppingNumbers }).forEach((_, i) => {

            const category = values[`category_${i + 1}`] as SliceTaglioCategory
            const amount = category === "margherita" ? 13 : category === "vegetariana" ? 17 : 24

            const slice = {
                topping: values[`topping_${i + 1}`] as string,
                category: category,
                amount: amount,
                outOfStock: false
            }
            slices.push(slice)

        })

        const [err, record] = await queryIt(cardapioPizzaAlTaglioEntity.createOrUpdate({
            slices: slices,
            published: false,
            publishedDate: null,
        }))

        if (err) {
            return serverError(err)
        }

        if (record?.acknowledged === false) {
            return badRequest("Registro nao criado")
        }

        console.log({ err, record })

        return ok("Sabores publicados")

    }

    return null
}

export default function CardapioPizzaAlTaglioNew() {
    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    return (
        <div className="flex flex-col mt-4">
            <h3 className="text-xl font-semibold text-muted-foreground mb-6">Novo cardapio</h3>
            <div className="border rounded-md p-4 md:p-6">
                <CardapioPizzaAlTaglioForm action={"cardapio-create"} />

            </div>
        </div>
    )
}