import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import Container from "~/components/layout/container/container";
import DoughForm from "~/domain/dough/components/dough-form/dough-form";
import { doughEntity } from "~/domain/dough/dough.entity.server";
import { Dough } from "~/domain/dough/dough.model.server";
import formatDate from "~/utils/format-date";
import getCurrentTime from "~/utils/get-current-time";
import { serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function loader() {
    return null
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "dough-create") {

        const dough: Dough = {
            name: values.name as string || "",
            note: values.note as string || "",
            flourTotalGrams: parseInt(values.flourTotalGrams as string) || 0,
            waterTotalPercentage: parseInt(values.waterTotalPercentage as string) || 0,
            currentTemperature: parseInt(values.currentTemperature as string) || 0,
        }

        const [err, itemCreated] = await tryit(doughEntity.create(dough))

        if (err) {
            return serverError({ message: err.message })
        }

        return redirect(`/dough/${itemCreated.id}`)

    }
    return null
}


export default function DoughNew() {
    return (
        <Container>
            <div className="mb-8">
                <h1 className="font-semibold text-lg mb-2">Nuovo Impasto</h1>
                <div className="grid grid-cols-2">
                    <span className="text-sm text-gray-500">Giorno: {formatDate(new Date())}</span>
                    <span className="text-sm text-gray-500">Ore: {getCurrentTime()}</span>
                </div>
            </div>
            <DoughForm action="dough-create" />
        </Container>
    )
}




