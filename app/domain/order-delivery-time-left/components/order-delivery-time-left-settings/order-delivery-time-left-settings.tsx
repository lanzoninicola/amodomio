import { Form, useLoaderData } from "@remix-run/react"
import { count } from "node:console"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { loader } from "~/routes/admin.orders-delivery-time-left"

export default function OrdersDeliveryTimeLeftSettings() {
    const loaderData = useLoaderData<typeof loader>()
    const deliveryTimeSettings = loaderData?.payload?.deliveryTimeSettings
    const counterTimeSettings = loaderData?.payload?.counterTimeSettings
    const stockMassaSettings = loaderData?.payload?.stockMassaSettings

    return (
        <div className="flex flex-col">
            <Form method="post" className="flex flex-col gap-2">
                <h3 className="font-semibold">Retiro no balcão (minutos)</h3>
                <input type="hidden" name="context" value="order-timeline-segmentation-delivery-time" />
                <div className="flex flex-col gap-2">
                    <div className="flex gap-4 items-center justify-between">
                        <span>Tempo minimo</span>
                        <Input type="text" id="minTimeCounterMinutes" name="minTimeCounterMinutes" maxLength={2} className="w-[72px] bg-white"
                            defaultValue={counterTimeSettings?.minTime || 0}
                        />
                    </div>
                    <div className="flex gap-4 items-center justify-between">
                        <span>Tempo maximo</span>
                        <Input type="text" id="maxTimeCounterMinutes" name="maxTimeCounterMinutes" maxLength={2} className="w-[72px] bg-white"
                            defaultValue={counterTimeSettings?.maxTime || 0}
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-2">
                    <SubmitButton actionName="order-timeline-segmentation-settings-change" />
                </div>
            </Form>
            <Separator className="my-4" />
            <Form method="post" className="flex flex-col gap-2">
                <h3 className="font-semibold">Tempo de entrega (minutos)</h3>
                <input type="hidden" name="context" value="order-timeline-segmentation-delivery-time" />
                <div className="flex flex-col gap-2">
                    <div className="flex gap-4 items-center justify-between">
                        <span>Tempo minimo</span>
                        <Input type="text" id="minTimeDeliveryMinutes" name="minTimeDeliveryMinutes" maxLength={2} className="w-[72px] bg-white"
                            defaultValue={deliveryTimeSettings?.minTime || 0}
                        />
                    </div>
                    <div className="flex gap-4 items-center justify-between">
                        <span>Tempo maximo</span>
                        <Input type="text" id="maxTimeDeliveryMinutes" name="maxTimeDeliveryMinutes" maxLength={2} className="w-[72px] bg-white"
                            defaultValue={deliveryTimeSettings?.maxTime || 0}
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-2">
                    <SubmitButton actionName="order-timeline-segmentation-settings-change" />
                </div>
            </Form>
            <Separator className="my-4" />
            <Form method="post" className="flex flex-col gap-2">
                <h3 className="font-semibold">Numero massas</h3>
                <input type="hidden" name="context" value="stockMassa" />
                <div className="flex flex-col gap-2">
                    <div className="flex gap-4 items-center justify-between">
                        <span>Massa Familia (nr)</span>
                        <Input type="text" id="massaFamilia" name="massaFamilia" maxLength={2} className="w-[72px] bg-white"
                            defaultValue={stockMassaSettings?.massaFamilia || 0}
                        />
                    </div>
                    <div className="flex gap-4 items-center justify-between">
                        <span>Massa Media (nr)</span>
                        <Input type="text" id="massaMedia" name="massaMedia" maxLength={2} className="w-[72px] bg-white"
                            defaultValue={stockMassaSettings?.massaMedia || 0}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-4">
                    <SubmitButton actionName="order-delivery-time-left-stockMassa-settings-change" />
                    <SubmitButton actionName="order-delivery-time-left-archive-active-records"
                        idleText="Reset" loadingText="Resetting..." variant={"outline"}
                        className="border-red-500"
                        labelClassName="text-red-500"
                        iconColor="red"
                    />
                </div>
            </Form>

        </div>
    )
}