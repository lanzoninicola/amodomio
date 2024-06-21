import { useLoaderData } from "@remix-run/react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Input } from "~/components/ui/input"
import { loader } from "~/routes/admin.cardapio._index"

export default function OrdersDeliveryTimeLeftSettings() {
    const loaderData = useLoaderData<typeof loader>()
    const deliveryTimeSettings = loaderData?.payload?.deliveryTimeSettings
    const counterTimeSettings = loaderData?.payload?.counterTimeSettings

    return (
        <>
            <div className="flex flex-col gap-2">
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
            </div>
            <div className="flex flex-col gap-2">
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
            </div>
            <div className="flex justify-end">
                <SubmitButton actionName="order-timeline-segmentation-settings-change" />
            </div>
        </>
    )
}