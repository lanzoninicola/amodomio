import { Form, Link, useActionData, useOutletContext } from "@remix-run/react";
import { Input } from "~/components/ui/input";
import { type ActionFunctionArgs } from "@remix-run/node";
import errorMessage from "~/utils/error-message";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import { productEntity } from "~/domain/product/product.entity";
import type { ProductOutletContext } from "./admin.products.$id";
import { TableRow, TableTitles, Table, DeleteItemButton } from "~/components/primitives/table-list";
import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import randomReactKey from "~/utils/random-react-key";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import { ComponentSelector } from "./admin.resources.component-selector";
import type { Product, ProductComponent } from "~/domain/product/product.model.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import toNumber from "~/utils/to-number";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import SelectProductUnit from "~/domain/product/components/select-product-unit/select-product-unit";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";



export async function action({ request }: ActionFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const parentProductId = values.parentId as string

    if (_action === "composition-add-component") {

        if (!parentProductId) {
            return badRequest({ action: "composition-add-component", message: "O ID do produto não foi informado" })
        }

        if (!jsonParse(values.component)) {
            return badRequest({ action: "composition-add-component", message: "Occorreu um erro adicionando o componente" })
        }

        const product: Product = jsonParse(values.component)

        const newComponent: ProductComponent = {
            parentId: parentProductId,
            product: product,
            quantity: 0,
            unit: "un",
            unitCost: 0,
            menuDescription: product.name
        }

        const [err, data] = await tryit(productEntity.addComponent(parentProductId, newComponent))

        if (err) {
            return badRequest({ action: "composition-add-component", message: errorMessage(err) })
        }

        return ok({ message: "Elemento adicionado com sucesso" })
    }

    if (_action === "composition-update-component") {

        const component = jsonParse(values.component) as ProductComponent

        if (!component) {
            return badRequest({ action: "composition-update-component", message: "Occorreu um erro atualizando o componente" })
        }

        const componentId = component.product.id

        const [err, data] = await tryit(productEntity.updateComponent(parentProductId, componentId as string, {
            ...component,
            unit: values.unit,
            quantity: toNumber(values.quantity),
            unitCost: toNumber(values.unitCost),
            menuDescription: values.menuDescription !== "" ? values.menuDescription : component.product.name,
        }))

        if (err) {
            return badRequest({ action: "composition-update-component", message: errorMessage(err) })
        }

        return ok({ message: "Elemento atualizado com sucesso" })

    }

    if (_action === "composition-delete-component") {
        const component = jsonParse(values.component) as ProductComponent

        if (!component) {
            return badRequest({ action: "composition-delete-component", message: "Occorreu um erro removendo o componente" })
        }

        const componentId = component.product.id

        const [err, data] = await tryit(productEntity.removeComponent(parentProductId, componentId as string))

        if (err) {
            return badRequest({ action: "composition-delete-component", message: errorMessage(err) })
        }

        return ok({ message: "Elemento removido com sucesso" })

    }

    if (_action === "cucu") {

        console.log(values)

        return null
    }

    return null
}

export default function SingleProductComposition() {
    const context = useOutletContext<ProductOutletContext>()
    const product = context.product as Product



    return (
        <div className="flex flex-col gap-8 h-full">
            <ComponentSelector parentProductId={product.id} />
            <ProductComponentList />
        </div>
    )
}



function ProductComponentList() {

    const context = useOutletContext<ProductOutletContext>()
    const components = context.product?.components as ProductComponent[]

    const formSubmissionState = useFormSubmissionnState()

    if (components?.length === 0 || !components) {
        return <NoRecordsFound text="Nenhum componente adicionado" />
    }

    return (
        <Table>
            <TableTitles
                clazzName="grid-cols-5"
                titles={[
                    "Nome",
                    "Unidade",
                    "Quantidade",
                    "Descriçao Cardapio",
                    "Ações"
                ]}
            />

            {components?.length > 0 && (
                components.map((component) => {
                    return (
                        <Form method="post" key={component.product.id || randomReactKey()}>
                            <TableRow
                                row={component}
                                showDateColumns={false}
                                clazzName="grid-cols-5"
                            // isProcessing={formSubmissionState === "inProgress"}
                            >

                                <div>
                                    <Input type="hidden" name="parentId" value={component.parentId} />
                                    <Input type="hidden" name="component" value={jsonStringify(component)} readOnly />
                                    <Tooltip content="Clique para abrir o produto">
                                        <Link to={`/admin/products/${component.product.id}/info`} target="_blank">
                                            <span className="font-medium">{component.product.name}</span>
                                        </Link>
                                    </Tooltip>

                                </div>
                                <SelectProductUnit />
                                <Input name="quantity" defaultValue={component.quantity} className="w-[120px]" />
                                <Input name="menuDescription" defaultValue={component.menuDescription} className="w-full" />
                                <div className="flex gap-2">
                                    <SaveItemButton actionName="composition-update-component" formSubmissionState={formSubmissionState} />
                                    <DeleteItemButton actionName="composition-delete-component" />
                                </div>
                            </TableRow>
                        </Form >
                    )
                })
            )}
        </Table>

    )

}

