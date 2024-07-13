import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { RotateCcw } from "lucide-react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { StockProduct, stockMassaEntity } from "~/domain/stock-massa/stock-massa.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { ok, serverError } from "~/utils/http-response.server";


export const loader: LoaderFunction = async ({ request, params }) => {
    await stockMassaEntity.loadInitial()

    return ok({ familia: stockMassaEntity.getInitialFamilia(), media: stockMassaEntity.getInitialMedia() })
}

export const action: ActionFunction = async ({ request }) => {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "stock-massa-init-familia") {

        const massaFamiliaAmount = isNaN(Number(values.massaFamiliaAmount)) ? 0 : Number(values.massaFamiliaAmount)

        const [err, result] = await prismaIt(stockMassaEntity.updateInitialStock({
            type: 'familia',
            amount: massaFamiliaAmount,
        }))

        if (err) {
            return serverError(err)
        }

        return ok({
            action: "stock-massa-init-familia",
            message: "Elemento atualizado com successo",
        })
    }

    if (_action === "stock-massa-init-media") {

        const massaMediaAmount = isNaN(Number(values.massaMediaAmount)) ? 0 : Number(values.massaMediaAmount)

        const [err, result] = await prismaIt(stockMassaEntity.updateInitialStock({
            type: 'media',
            amount: massaMediaAmount,
        }))

        if (err) {
            return serverError(err)
        }

        return ok({
            action: "stock-massa-init-familia",
            message: "Elemento atualizado com successo",
        })
    }

    return null
}

export default function GerenciamentoInitialStockMassa() {

    const loaderData = useLoaderData<typeof loader>()

    const familiaAmount: StockProduct["initial"] = loaderData?.payload?.familia || 0
    const mediaAmount: StockProduct["initial"] = loaderData?.payload?.media || 0

    return (
        <Container >
            <div className="flex flex-col gap-4 p-4">
                <h1 className="text-xl tracking-tight font-semibold">Inizializar estoque massa</h1>
                <div className="flex flex-col gap-8">
                    <Form method="post" className="flex flex-col gap-2 rounded-lg border p-4 justify-center" >
                        <h3 className="font-semibold mb-4 text-center md:text-2xl">Massa Familia</h3>
                        <div className="flex justify-center w-full mb-4">
                            <Input type="text" name="massaFamiliaAmount" maxLength={2} className="bg-white text-6xl py-8 w-[150px] text-center"
                                defaultValue={familiaAmount || 0}
                            />
                        </div>
                        <div className="flex w-full  md:justify-center">
                            <SubmitButton actionName="stock-massa-init-familia" size={"lg"} />
                        </div>
                    </Form>
                    <Form method="post" className="flex flex-col gap-2 rounded-lg border p-4">
                        <h3 className="font-semibold mb-4 text-center md:text-2xl">Massa Media</h3>
                        <div className="flex justify-center w-full mb-4">
                            <Input type="text" name="massaMediaAmount" maxLength={2} className="bg-white text-6xl py-8 w-[150px] text-center"
                                defaultValue={mediaAmount || 0}
                            />
                        </div>
                        <div className="flex w-full md:justify-center">
                            <SubmitButton actionName="stock-massa-init-media" size={"lg"} />
                        </div>
                    </Form>
                    <Form method="post" className="flex flex-col gap-2 p-4">
                        <div className="flex w-full  md:justify-center">
                            <SubmitButton actionName="archive-active-order-records"
                                idleText="Reset active order records" loadingText="Resetting..." variant={"outline"}
                                className="border-red-500"
                                labelClassName="text-red-500"
                                icon={<RotateCcw className="h-4 w-4" color="red" />}
                                size={'lg'}
                            />
                        </div>
                    </Form>
                </div>
            </div>
        </Container>

    )
}