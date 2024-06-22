import { Form, useLoaderData } from "@remix-run/react"
import { Settings } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog"
import { loader } from "~/routes/admin.gerenciamento.cardapio._index"
import OrdersDeliveryTimeLeftSettings from "../order-delivery-time-left-settings/order-delivery-time-left-settings"

interface OrdersDeliveryTimeLeftDialogSettingsProps {
    showLabel?: boolean
}


export default function OrdersDeliveryTimeLeftDialogSettings({ showLabel = true }: OrdersDeliveryTimeLeftDialogSettingsProps) {

    const loaderData = useLoaderData<typeof loader>()
    const locale = loaderData?.payload?.int.locale
    const timezone = loaderData?.payload?.int.timezone

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost">
                    <Settings />
                    {showLabel && <span className="ml-2">Configuraçoes</span>}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Configurações</DialogTitle>
                    <DialogDescription>
                        <div className="flex flex-col">
                            <span>Locale: {locale}</span>
                            <span>Timezone: {timezone}</span>
                        </div>

                    </DialogDescription>
                </DialogHeader>

                <Form method="post" className="flex flex-col gap-4 mt-2">
                    <OrdersDeliveryTimeLeftSettings />
                </Form>
            </DialogContent>
        </Dialog>
    )
}