import { Category } from "@prisma/client"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@radix-ui/react-select"
import { useLoaderData, Form } from "@remix-run/react"
import { Link, Trash } from "lucide-react"
import InputItem from "~/components/primitives/form/input-item/input-item"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Button } from "~/components/ui/button"
import Fieldset from "~/components/ui/fieldset"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import { MenuItem } from "~/domain/menu-item/menu-item.model.server"
import { MenuItemActionSearchParam, loader } from "~/routes/admin.cardapio._index"

interface MenuItemFormProps {
    categoryId?: string
    item: MenuItem
    action: Partial<MenuItemActionSearchParam>
}

export default function MenuItemForm({ item, action }: MenuItemFormProps) {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]

    const ingredientsString = item?.ingredients && item.ingredients.join(", ")
    const ingredientsItaString = item?.ingredientsIta && item.ingredientsIta.join(", ")


    const submitButtonIdleText = action === "menu-item-edit" ? "Atualizar" : "Criar"
    const submitButtonLoadingText = action === "menu-item-edit" ? "Atualizando..." : "Criando..."

    if (action !== "menu-item-edit" && action !== "menu-item-create") return null

    const navigationBackLink = item.category?.id ? `/admin` : "/admin"

    return (

        <div className="p-4 rounded-md border-2 border-muted">
            <Form method="post" className="">
                <div className="flex justify-between items-center">
                    <div className="flex gap-2 mb-4 items-center">
                        <span className="text-xs font-semibold">Pizza ID:</span>
                        <span className="text-xs">{item.id}</span>
                    </div>
                    <Link to={navigationBackLink} className="text-xs underline">
                        <Button type="button" variant="outline" size="sm" className="border-black">
                            Voltar
                        </Button>
                    </Link>
                </div>
                <Fieldset>
                    <InputItem type="hidden" name="id" defaultValue={item.id} />
                    <InputItem type="text" name="name" defaultValue={item.name} placeholder="Nome pizza" />
                </Fieldset>
                <Fieldset>
                    <Fieldset>
                        <div className="md:max-w-[150px]">
                            <Select name="categoryId" defaultValue={item?.category?.id ?? undefined}>
                                <SelectTrigger >
                                    <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent id="categoryId"   >
                                    <SelectGroup >
                                        {categories && categories.map(category => {
                                            return (
                                                <SelectItem key={category.id} value={category.id ?? ""} className="text-lg">{category.name}</SelectItem>
                                            )
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </Fieldset>
                </Fieldset>
                {/* <Fieldset>
                    <InputItem type="text" name="description" defaultValue={item.description} placeholder="Descrição" />
                </Fieldset> */}
                <Fieldset>
                    <InputItem type="text" name="price" defaultValue={item.price} placeholder="Preço" />
                </Fieldset>
                <Fieldset>
                    <InputItem type="text" name="ingredients" defaultValue={ingredientsString} placeholder="Ingredientes" />
                </Fieldset>
                <Fieldset>
                    <InputItem type="text" name="ingredientsIta" defaultValue={ingredientsItaString} placeholder="Ingredientes em Italiano" />
                </Fieldset>

                <Fieldset>
                    <Label htmlFor="visible" className="flex gap-2 items-center justify-end">
                        Visível
                        <Switch id="visible" name="visible" defaultChecked={item.visible} />
                    </Label>
                </Fieldset>
                <div className="flex gap-4">
                    <Button type="submit" variant="destructive" name="_action" value="menu-item-delete" className="flex-1">
                        <Trash size={16} className="mr-2" />
                        Excluir
                    </Button>
                    <SubmitButton actionName={action} idleText={submitButtonIdleText} loadingText={submitButtonLoadingText} />

                </div>
            </Form>
        </div>

    )
}