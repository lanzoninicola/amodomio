import { Setting } from "@prisma/client";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { AlertCircle } from "lucide-react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        {
            name: "title",
            content: "Settings",
        }
    ];
};

export async function loader({ request }: LoaderArgs) {

    const [err, settings] = await tryit(settingPrismaEntity.findAll())

    if (err) {
        return badRequest(err)
    }

    const contexts = await settingPrismaEntity.findAllContexts()

    return ok({ settings, contexts: contexts || [] })
}


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    console.log({ action: _action, values })



    if (_action === "setting-create") {

        const context = values?.context as string
        const name = values.name as string
        const value = values.value as string
        const createdAt = new Date().toISOString()
        const type = values.type as string

        const [err, setting] = await tryit(settingPrismaEntity.create({ name, value, context, createdAt, type }))

        if (err) {
            return badRequest(err)
        }

        return ok("Opção criada com successo")
    }

    return null
}

export default function SettingIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const settings: Setting[] = loaderData?.payload?.settings || []

    if (loaderData?.status > 399) {
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Oops</AlertTitle>
            <AlertDescription>
                {loaderData?.message}
            </AlertDescription>
        </Alert>
    }

    console.log({ actionData })

    if (actionData && actionData?.status === 400) {
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Oops</AlertTitle>
            <AlertDescription>
                {actionData?.message}
            </AlertDescription>
        </Alert>
    }


    return (

        <Container>
            <div className="left-0 w-full p-4 bg-muted mb-8" >
                <div className="flex items-center justify-between mb-4">
                    <h1 className="font-bold text-xl">Settings</h1>
                </div>
            </div>

            <SettingForm action="setting-create" />
            <div className="flex flex-col gap-4">

                {
                    settings.map(s =>
                        <SettingForm key={s.id} setting={s} action="setting-update" />
                    )
                }
            </div>

        </Container>

    )

}

type SettingFormAction = "setting-create" | "setting-update"

interface SettingFormProps {
    setting?: Setting
    action: SettingFormAction
}

function SettingForm({ setting, action }: SettingFormProps) {


    const settingTypes = ["string", "boolean", "float"]

    return (
        <Form method="post" className={
            cn(
                action === "setting-create" && "p-4 border rounded-lg"
            )
        }>
            {/* <Label htmlFor="waNumberForOrders">{setting.name}</Label> */}

            {
                action === "setting-create" &&
                <h4 className="font-semibold text-sm mb-6">Nova opção</h4>
            }

            <ContextField action={action} setting={setting} />

            <Fieldset className="grid grid-cols-4">
                <Label htmlFor="name">Nome</Label>
                <Input name="name" value={setting?.name} className="col-span-3" />
            </Fieldset>


            <Fieldset className="grid grid-cols-4">
                <Label htmlFor="type">Tipo</Label>
                <Select name="type" required defaultValue={setting?.type || ""}>
                    <SelectTrigger className="col-span-3" >
                        <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent >
                        <SelectGroup >
                            {settingTypes.map(item => (
                                <SelectItem key={item} value={String(item)}>{item}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Fieldset>
            <Fieldset className="grid grid-cols-4">
                <Label htmlFor="value">Valor</Label>
                <Input name="value" value={setting?.value} className="col-span-3" />
            </Fieldset>


            <SubmitButton actionName={action} className="mt-6">Salvar</SubmitButton>
        </Form>
    )
}


function ContextField({ action, setting }: { action: SettingFormAction, setting?: Setting }) {

    const loaderData = useLoaderData<typeof loader>()
    const contexts: string[] = loaderData?.payload?.contexts || []

    if (action === "setting-create" && contexts.length > 0) {
        return (
            <Fieldset className="grid grid-cols-4">
                <Label htmlFor="context">Contexto</Label>
                <Select name="context" required defaultValue={contexts[0] || ""}>
                    <SelectTrigger className="col-span-3" >
                        <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent >
                        <SelectGroup >
                            {contexts.map(item => (
                                <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Fieldset>
        )
    }

    if (action === "setting-update" || contexts.length === 0) {
        return (
            <Fieldset className="grid grid-cols-4">
                <Label htmlFor="context">Contexto</Label>
                <Input name="context" value={setting?.context} className="col-span-3" />
            </Fieldset>
        )
    }

    return null


}

