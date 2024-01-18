import { Label } from "@radix-ui/react-label"
import { useLoaderData, Form } from "@remix-run/react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import Fieldset from "~/components/ui/fieldset"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { loader } from "~/routes/admin.cardapio._index"
import { CategoryTypeSelectElement } from "../../category.entity.server"
import { Category } from "../../category.model.server"

interface CategoryFormProps {
    action: "category-create" | "category-update"
    category?: Category
}

export default function CategoryForm({ action, category }: CategoryFormProps) {
    const loaderData = useLoaderData<typeof loader>()
    const types = loaderData?.payload.types as CategoryTypeSelectElement[]


    return (
        <Form method="post">
            <input type="hidden" name="id" value={category?.id} />

            <Fieldset>
                <div className="flex justify-between">
                    <Label htmlFor="name" className="pt-2">Nome</Label>
                    <Input name="name" placeholder="Nome" defaultValue={category?.name || ""} className="max-w-[300px]" />
                </div>
            </Fieldset>

            <Fieldset>
                <div className="flex justify-between items-start ">
                    <Label htmlFor="description" className="pt-2">Tipo</Label>
                    <div className="flex flex-col gap-2 w-[300px]">
                        <Select name="type" defaultValue={category?.type} required >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup >
                                    {types.map((t, idx) => {
                                        return <SelectItem key={idx} value={t.value}>{t.label}</SelectItem>
                                    })}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Fieldset>


            <SubmitButton actionName={action} />
        </Form>
    )
}