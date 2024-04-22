import { RecipeType } from "@prisma/client"
import { ActionArgs } from "@remix-run/node"
import { Form, useActionData, useLoaderData } from "@remix-run/react"
import Container from "~/components/layout/container/container"
import InputItem from "~/components/primitives/form/input-item/input-item"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Separator } from "~/components/ui/separator"
import { toast } from "~/components/ui/use-toast"
import { productEntity } from "~/domain/product/product.entity"
import { prismaClient, prismaIt } from "~/lib/prisma/prisma-it.server"
import { ok, serverError } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"

export async function loader() {

    const [err, data] = await prismaIt(prismaClient.product.findMany())

    return ok({
        products: data
    })

}

export async function action({ request }: ActionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // if (_action === "units-create") {
    //    const [err, data] = await prismaIt(prismaClient.unit.createMany({
    //         data: [
    //             { name: "GR" },
    //             { name: "UN" },
    //             { name: "LT" },
    //         ]
    //     }))

    //     if (err) return serverError(err)

    //     return ok()

    // }

    if (_action === "products-migration") {


        const [errFbProducts, dataFbProducts] = await tryit(productEntity.findByType("simple"))

        // console.log({ dataFbProducts })

        // [{ "id": "0f4fc841-4c21-42bf-acec-6487e192f750", "name": "GR" }, { "id": "1cf8118f-65b7-405a-9e65-1deb2d2cdb47", "name": "UN" }, { "id": "58659a55-4906-44bd-b38e-059dc300eca3", "name": "LT" }]

        const dataFbProductsMapped = dataFbProducts?.map(p => {

            return {
                name: p.name,
                // unitId: p.unit === "gr" ? "0f4fc841-4c21-42bf-acec-6487e192f750" : p.unit === "un" ? "1cf8118f-65b7-405a-9e65-1deb2d2cdb47" : "58659a55-4906-44bd-b38e-059dc300eca3",
                showInMenu: false
            }


        })

        if (dataFbProductsMapped === undefined) {
            return serverError("Products not found")
        }

        const [err, data] = await prismaIt(prismaClient.product.createMany({
            data: dataFbProductsMapped
        }))

        if (err) return serverError(err)

        return ok()

    }

    if (_action === "recipes-migration") {


        const [errProcessed, recordsProcessed] = await tryit(productEntity.findByType("processed"))
        const [errTopping, recordsTopping] = await tryit(productEntity.findByType("topping"))


        if (recordsProcessed === undefined || recordsTopping === undefined) {
            return serverError("Products not found")
        }

        const rawRecipies = [...recordsProcessed, ...recordsTopping]

        const recipesProcessed = recordsProcessed.map(r => {
            return {
                name: r.name,
                type: "semi-finished" as RecipeType
            }
        })

        const recipesTopping = recordsTopping.map(r => {
            return {
                name: r.name,
                type: "pizza-topping" as RecipeType
            }
        })


        if (recipesProcessed === undefined || recipesTopping === undefined) {
            return serverError("Recipies not found")
        }



        const [errPrismaProcessed, dataProcessed] = await prismaIt(prismaClient.recipe.createMany({
            data: recipesProcessed
        }))

        const [errPrismaTopping, dataTopping] = await prismaIt(prismaClient.recipe.createMany({
            data: recipesTopping
        }))

        console.log({ errPrismaProcessed, errPrismaTopping })

        if (errPrismaProcessed) return serverError(errPrismaProcessed)

        return ok()

    }



}


export default function PrismaTest() {
    const loaderData = useLoaderData<typeof loader>()
    const products = loaderData?.payload.products as any

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    return (
        <Container>
            <h1 className="mb-6">Prisma Migration</h1>

            <div className="flex flex-col gap-6">
                <section>
                    <Form method="post" className="mb-4">
                        <SubmitButton actionName="units-create" idleText="Create units" loadingText="Creating units" />
                    </Form>
                    <Separator />
                </section>
                <section>
                    <Form method="post" className="mb-4">
                        <SubmitButton actionName="products-migration" idleText="Migrate products" loadingText="Migrating Products" />
                    </Form>
                    <Separator />
                </section>
                <section>
                    <Form method="post" className="mb-4">
                        <SubmitButton actionName="recipes-migration" idleText="Migrate Recipies" loadingText="Migrating Recipies" />
                    </Form>
                    <Separator />
                </section>

            </div>



        </Container>
    )
}