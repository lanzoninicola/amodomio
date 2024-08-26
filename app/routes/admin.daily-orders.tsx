import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData, useOutletContext } from "@remix-run/react";
import { PlusCircleIcon } from "lucide-react";
import Container from "~/components/layout/container/container";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import { now } from "~/lib/dayjs";
import { ok, serverError } from "~/utils/http-response.server";
import { AdminOutletContext } from "./admin";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import tryit from "~/utils/try-it";
import { DeleteItemButton } from "~/components/primitives/table-list";

export async function loader({ request }: LoaderFunctionArgs) {

    const user = await authenticator.isAuthenticated(request)

    const records = await dailyOrderEntity.findAllLimit(10, { order: "desc" })


    return ok({
        records,
        loggedUser: user
    })

}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "daily-order-delete") {

        const [err, data] = await tryit(dailyOrderEntity.delete(values.id as string))

        if (err) {
            return serverError(err)
        }

        return redirect("/admin/daily-orders")
    }

    return

}

export default function AdminDailyOrdersIndex() {


    return (
        <div className="mt-12">
            <div className="flex justify-between pb-6 px-6 border-b-2 border-b-slate-100 h-[60px]">
                <div className="flex flex-col">
                    <h1 className="font-bold text-xl">Pedidos giornalieri</h1>
                    <span className="font-sm">Data: {now()}</span>
                </div>

                {/* <Link to="/admin/daily-orders/list" className="mr-4">
                    <span className="text-sm underline">Lista dos pedidos</span>
                </Link> */}
            </div>
            <Sidebar />

        </div>

    )
}


function Sidebar() {
    const adminOutletContext = useOutletContext<AdminOutletContext>()

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrders = loaderData.payload.records as DailyOrder[]

    return (
        <div className="flex gap-6 min-h-screen">
            <aside id="default-sidebar" className="top-32 z-40 w-64
            transition-transform -translate-x-full sm:translate-x-0 border-r-2 border-r-slate-100" aria-label="Sidebar">
                <div className="px-3 py-4 w-full">
                    <Link to={`/admin/daily-orders/new`}>
                        <Button className="flex gap-2 items-center w-full">
                            <span className="text-md font-semibold">Novo dia</span>
                            <PlusCircleIcon size={16} />
                        </Button>
                    </Link>
                </div>
                <div className="h-full px-3 py-4 overflow-y-auto ">

                    <ul className="space-y-2 font-medium">
                        <ScrollArea className="h-1/2">
                            {
                                dailyOrders.map(dailyOrder => {
                                    return (
                                        <div key={dailyOrder.id} >
                                            <div className="flex items-center justify-between">
                                                <Link to={`/admin/daily-orders/${dailyOrder.id}/transactions`} className="block px-2 py-4 w-full hover:bg-slate-100 hover:rounded-lg" >
                                                    <span className="text-xs font-semibold">{dailyOrder.date}</span>
                                                </Link>
                                                <Form method="post">
                                                    <input type="hidden" name="id" value={dailyOrder.id} />
                                                    <DeleteItemButton actionName="daily-order-delete" />
                                                </Form>
                                            </div>
                                            <Separator />
                                        </div>
                                    )
                                })
                            }


                        </ScrollArea>
                    </ul>
                </div>
                <div className="h-full px-3 py-4 overflow-y-auto ">
                    <ul className="space-y-2 font-medium">

                    </ul>
                </div>2
            </aside>
            <div className="py-6 px-4 w-full">
                <Outlet context={
                    { ...adminOutletContext }
                } />
            </div>
        </div>
    )
}