import { Link, useLoaderData } from "@remix-run/react";
import { Edit } from "lucide-react";
import { groceryListEntity } from "~/domain/grocery-list/grocery-list.entity.server";
import { GroceryList } from "~/domain/grocery-list/grocery-list.model.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { ok, serverError } from "~/utils/http-response.server";



export async function loader() {
    const [err, records] = await prismaIt(prismaClient.groceryList.findMany())

    if (err) {
        return serverError(err)
    }


    return ok({ groceriesList: records })
}


export default function AdminGroceryListIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const groceriesList = loaderData.payload.groceriesList as GroceryList[]

    return (

        <ul className="min-w-[350px]">
            {
                groceriesList.map(gl => {
                    return (
                        <li key={gl.id} className="mb-4">
                            <GroceryListItem item={gl} />
                        </li>
                    )
                })
            }
        </ul>
    )
}

interface GroceryListItemProps {
    item: GroceryList
}

function GroceryListItem({ item }: GroceryListItemProps) {
    return (

        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2 w-full`}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-lg font-bold tracking-tight">{item.name}</h2>
                <Link to={`${item.id}`} >
                    <Edit size={24} className="cursor-pointer" />
                </Link>
            </div>
        </div>
    )
}