import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, Link, Outlet, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronRight, Globe, PlusSquareIcon, SaveIcon } from "lucide-react";
import { PlusIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import GroceryItem from "~/domain/grocery-list/components/grocery-item";
import { groceryListEntity } from "~/domain/grocery-list/grocery-list.entity.server";
import { GroceryList } from "~/domain/grocery-list/grocery-list.model.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";


export async function loader({ request, params }: LoaderArgs) {

    const listId = params?.id

    if (!listId) {
        return redirect("/admin/grocery-list")
    }

    const [err, list] = await tryit(groceryListEntity.findById(listId))

    if (err) {
        return serverError(err)
    }

    return ok({ list })

}


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "start-purchase") {

        const [err, list] = await tryit(groceryListEntity.startPurchase(values.listId as string))

        if (err) {
            return serverError(err)
        }

        return redirect(`/purchasing?id=${values.listId}`)
    }

    if (_action === "item-delete") {


        const [err, list] = await tryit(groceryListEntity.removeItem(values.listId as string, values.itemId as string))

        if (err) {
            return serverError(err)
        }

        return ok("Produto removido da lista")
    }

    return null
}


export default function SingleGroceryList() {
    const loaderData = useLoaderData<typeof loader>()
    const list = loaderData?.payload.list as GroceryList

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    if (status == 200) {
        toast({
            title: "Ok",
            description: message,
        })
    }

    return (
        <div className="flex flex-col gap-4">

            <Link to="products">
                <div className="flex gap-2 items-center justify-end">
                    <span className="">Adicionar Produtos</span>
                    <PlusSquareIcon />
                </div>
            </Link>

            <Outlet />
            <div className="flex flex-col mt-2">
                <div className="mb-6">
                    <h3 className="text-lg font-semibold tracking-tight mb-2">{list.name}</h3>
                    <Form method="post">
                        <input type="hidden" name="listId" value={list.id} />
                        <div className="flex gap-2">
                            <Button variant={"outline"} className="w-full md:w-max font-semibold border-slate-500 text-slate-500"
                                type="submit"
                                name="_action"
                                value="start-purchase"
                            >

                                <div className="flex gap-2 items-center">
                                    <span>Iniciar Compra</span>
                                    <ChevronRight size={16} />
                                </div>
                            </Button>
                            {/* <Button className="w-full md:w-max font-semibold bg-brand-green shadow-sm"
                                type="submit"
                                name="_action"
                                value="list-save"
                            >
                                <div className="flex gap-2 items-center">
                                    <span>Salvar</span>
                                    <SaveIcon size={16} />
                                </div>
                            </Button> */}
                        </div>
                    </Form>
                </div>


                <ul className="flex flex-col gap-4">
                    {list.items?.map((i, idx) => {
                        return (
                            <li key={i.id}>
                                <GroceryItem listId={list.id} item={i} state={"setting-up"} />
                            </li>
                        )
                    })}
                </ul>

            </div>
        </div>
    )
}

