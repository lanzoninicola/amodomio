
import { ActionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";

import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { cardapioPizzaAlTaglioEntity } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.entity.server";
import { CardapioPizzaAlTaglioModel } from "~/domain/cardapio-pizza-al-taglio/cardapio-pizza-al-taglio.model.server";
import { nowWithTime } from "~/lib/dayjs";
import { badRequest, serverError, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "topping-create") {

        const [err, record] = await tryit(cardapioPizzaAlTaglioEntity.insertOne({
            date: "2024-01-01",
            fullDate: nowWithTime(),
            sabores: ["prosciutto, funghi", "quatro queijos"]
        }))

        if (err) {
            return serverError(err)
        }

        if (record?.acknowledged === false) {
            return badRequest("Registro não criado")
        }

        console.log({ err, record })

        return ok("tudo de bom")

    }

    return null
}

export default function CardapioPizzaAlTaglioNew() {


    return (
        <div className="flex flex-col gap-6">
            <h3 className="text-xl font-semibold text-muted-foreground mb-3">Nova categoria</h3>
            <Form method="post">
                <SubmitButton actionName="topping-create" />
            </Form>
            <div className="border rounded-md p-4">
                {/* <CategoryForm action={"category-create"} /> */}

            </div>
        </div>
    )
}