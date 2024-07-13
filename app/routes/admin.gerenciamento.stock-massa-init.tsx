import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { StockProduct, stockMassaLoader } from "~/domain/stock-massa/stock-massa.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { ok, serverError } from "~/utils/http-response.server";


export const loader: LoaderFunction = async ({ request, params }) => {

    const [err, stock] = await prismaIt(stockMassaLoader.get())

    console.log({ stock })

    return ok({ stock })
}

export const action: ActionFunction = async ({ request }) => {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "stock-massa-init") {


        const massaMediaAmount = isNaN(Number(values.massaMediaAmount)) ? 0 : Number(values.massaMediaAmount)
        const massaFamiliaAmount = isNaN(Number(values.massaFamiliaAmount)) ? 0 : Number(values.massaFamiliaAmount)

        const [errUpMedia, resultUpMedia] = await prismaIt(stockMassaEntity.initStockMassa({
            type: 'media',
            amount: massaMediaAmount,
        }))

        if (errUpMedia) {
            return serverError(errUpMedia)
        }

        const [errUpFamilia, resultUpFamilia] = await prismaIt(stockMassaEntity.initStockMassa({
            type: 'familia',
            amount: massaFamiliaAmount,
        }))

        if (errUpFamilia) {
            return serverError(errUpFamilia)
        }


        return null
    }

    return null
}

export default function GerenciamentoStockMassaInit() {

    const loaderData = useLoaderData<typeof loader>()

    const familia: StockProduct = loaderData?.payload?.stock?.familia || 0
    const media: StockProduct = loaderData?.payload?.stock?.media || 0

    return (
        <div className="flex flex-col gap-4 p-4">
            <h1 className="text-xl tracking-tight font-semibold">Inizialiar estoque massa</h1>
            <div className="flex flex-col gap-8">
                <Form method="post" className="flex flex-col gap-2 rounded-lg border p-4">
                    <h3 className="font-semibold">Massa Familia</h3>
                    <div className="flex flex-col gap-6">
                        <Input type="text" name="massaFamiliaAmount" maxLength={2} className="bg-white text-xl"
                            defaultValue={familia.initial || 0}
                        />
                        <span className="text-xs text-muted-foreground">Massa atual: {familia.current}</span>
                    </div>
                    <div className="flex w-full gap-4">
                        <SubmitButton actionName="stock-massa-init-familia" size={"lg"} />
                    </div>
                </Form>
                <Form method="post" className="flex flex-col gap-2 rounded-lg border p-4">
                    <h3 className="font-semibold">Massa Media</h3>
                    <div className="flex flex-col gap-4">
                        <Input type="text" name="massaMediaAmount" maxLength={2} className="bg-white text-xl"
                            defaultValue={media.initial || 0}
                        />
                        <span className="text-xs text-muted-foreground">Massa atual: {media.current}</span>
                    </div>
                    <div className="flex w-full gap-4">
                        <SubmitButton actionName="stock-massa-init-familia" size={"lg"} />
                    </div>
                </Form>
                <Form method="post" className="flex flex-col gap-2 p-4">
                    <h3 className="font-semibold">Reset active order records</h3>
                    <SubmitButton actionName="archive-active-order-records"
                        idleText="Reset" loadingText="Resetting..." variant={"outline"}
                        className="border-red-500"
                        labelClassName="text-red-500"
                        iconColor="red"
                        size={'lg'}
                    />
                </Form>
            </div>
        </div>

    )
}