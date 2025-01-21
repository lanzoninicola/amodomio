import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { groceryListEntity } from "~/domain/grocery-list/grocery-list.entity.server";
import { now } from "~/lib/dayjs";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import capitalize from "~/utils/capitalize";
import { ok, serverError } from "~/utils/http-response.server";
import { jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";

export async function loader() {

    const [err, menuItems] = await tryit(menuItemPrismaEntity.findAll({
        where: {
            visible: true
        }
    }))

    if (err) {
        return serverError(err)
    }

    let menuItemsIngredients = [] as string[]

    if (Array.isArray(menuItems)) {
        menuItemsIngredients = [
            ...new Set(
                menuItems
                    .map(item => item.ingredients.split(',').map(ing => ing.trim().toLocaleLowerCase()))
                    .flat()
            )
        ];
    }

    return ok({ menuItemsIngredients })

}

export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "groceryt-list-create") {
        const name = values.name as string

        const ingredientsObj = { ...values }

        delete ingredientsObj._action
        delete ingredientsObj.name

        const ingredients = Object.entries(ingredientsObj).map(([key, value]) => {

            return {
                name: key,
                quantity: value === "" ? 0 : Number(value),
                createdAt: new Date().toISOString()
            }
        })



        const [err, record] = await prismaIt(prismaClient.groceryList.create({
            data: {
                name,
                createdAt: new Date().toISOString(),
                GroceryListItem: {
                    createMany: {
                        data: ingredients
                    }
                }
            }
        }))

        console.log({ err, record })

        if (err) {
            return serverError(err)
        }

        return redirect(`/admin/grocery-shopping-list/${record.id}`)


    }

    return null
}


export default function SingleGroceryListNew() {
    const loaderData = useLoaderData<typeof loader>()
    const menuItemsIngredients = loaderData?.payload.menuItemsIngredients as string[]

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

    const currentDateString: string = now()

    return (

        <div className="flex flex-col gap-4">
            <h2 className="font-lg font-bold tracking-tight ">Nova Lista</h2>
            <Form method="post"  >
                <Fieldset className="flex">
                    <Label htmlFor="name">Nome</Label>
                    <Input type="string" id="name" placeholder="Nome lista" name="name" required defaultValue={`Lista do dia ${currentDateString}`} />
                </Fieldset>
                <Separator className="my-4" />
                <ul>
                    {
                        menuItemsIngredients.sort((a, b) => a.localeCompare(b)).map(ing => (
                            <li key={ing} className="mb-2">
                                <div className="grid grid-cols-8 items-center">
                                    <span className="font-semibold tracking-tight col-span-6 md:col-span-4">{capitalize(ing)}</span>
                                    <Input type="number" name={ing} className="col-span-2 md:col-span-1 text-lg text-right" min={0} autoComplete="off" />
                                </div>
                            </li>
                        ))
                    }
                </ul>

                <div className="flex gap-2 mt-6">
                    <SubmitButton actionName="groceryt-list-create" className="w-full md:w-[150px] gap-2 text-md font-semibold uppercase tracking-wide" />
                </div>

            </Form>

        </div>
    )
}