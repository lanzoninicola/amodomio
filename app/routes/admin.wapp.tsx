import { ActionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { AlertCircle, CheckCheck } from "lucide-react";
import { AlertError, AlertOk } from "~/components/layout/alerts/alerts";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import Fieldset from "~/components/ui/fieldset";
import { Separator } from "~/components/ui/separator";
import { wappEntity } from "~/domain/wapp/wapp.entity.server";
import useFormResponse from "~/hooks/useFormResponse";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";




export async function action({ request }: ActionArgs) {


    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "check-service-status") {
        const [err, _] = await tryit(wappEntity.heartbeat())


        if (err) {
            return badRequest({
                ...err,
                message: err.message,
                actionName: "check-service-status"

            })
        }

        return ok({
            message: "Serviço disponivel",
            actionName: "check-service-status"
        })
    }

    // if (_action === "create-qr-code") {
    //     // const [err, response] = await tryit(wappEntity.createQRCode())

    //     // console.log({ err, response })


    //     // if (err) {
    //     //     return badRequest(err)
    //     // }

    //     // return ok(response)

    //     return ok("QRCode criado")
    // }

    // Default response if no known action is matched
    return badRequest("Ação não reconhecida");


}

export default function AdminWapp() {
    const actionData = useActionData<typeof action>()

    console.log({ actionData })


    return (
        <Container>
            <h1 className="font-semibold text-xl tracking-tight">Administração do chatbot Whatsapp</h1>

            <Separator className="my-6" />

            <div className="flex flex-col gap-4">
                <div className="border rounded p-4 max-w-2xl">
                    <h2 className="text-xs font-semibold tracking-tight mb-4">Generale</h2>

                    <div className="flex flex-col gap-4">

                        <Form method="post">

                            <div className="flex flex-col gap-4">
                                <Fieldset className="grid grid-cols-2 lg:grid lg:grid-cols-4">
                                    <span className="text-sm">Status do serviço</span>
                                    <SubmitButton id="checkstatus"
                                        actionName="check-service-status" className="lg:col-span-3 justify-self-end"
                                        idleText="Verificar"
                                        loadingText="Verificando..."
                                        icon={<CheckCheck />}
                                        classNameLabel="uppercase tracking-wider text-sm font-semibold"
                                    />
                                </Fieldset>

                                {actionData && actionData?.payload?.actionName === "check-service-status" && (
                                    <Alert variant={actionData?.status !== 200 ? "destructive" : "default"} >
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>{actionData?.status !== 200 ? "Ooopss..." : "Ok"}</AlertTitle>
                                        <AlertDescription>
                                            {actionData?.message}
                                        </AlertDescription>
                                    </Alert>
                                )}


                            </div>

                        </Form>
                    </div>
                </div>

                <div className="border rounded p-4 max-w-2xl">
                    <h2 className="text-xs font-semibold tracking-tight mb-4">QRCode</h2>

                    <div className="flex flex-col gap-4">

                        <Form method="post">

                            <Fieldset className="grid grid-cols-2 lg:grid lg:grid-cols-4">
                                <span className="text-sm">Criar o QRCode</span>
                                <input type="hidden" name="cucu" value="cucu" />
                                <SubmitButton
                                    actionName="create-qr-code-22" className="lg:col-span-3 justify-self-end"
                                    idleText="Criar"
                                    loadingText="Criando..."
                                    classNameLabel="uppercase tracking-wider text-sm font-semibold"
                                />
                            </Fieldset>

                        </Form>
                    </div>
                </div>
            </div>
        </Container>
    )
}