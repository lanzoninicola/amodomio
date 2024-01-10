import { Label } from "@radix-ui/react-label"
import { Switch } from "@radix-ui/react-switch"
import { Form } from "@remix-run/react"
import { Link, Trash } from "lucide-react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Button } from "~/components/ui/button"
import Fieldset from "~/components/ui/fieldset"
import { Category } from "../../category.model.server"

interface CategoryFormProps {
    category: Category
    action: "category-create" | "category-edit"
}

export default function CategoryForm({ category, action }: CategoryFormProps) {

    const submitButtonIdleText = action === "category-edit" ? "Atualizar" : "Criar"
    const submitButtonLoadingText = action === "category-edit" ? "Atualizando..." : "Criando..."

    return (

        <div className="p-4 rounded-md border-2 border-muted">
            <Form method="post" className="">
                <div className="flex justify-between">
                    <div className="flex gap-2 mb-4">
                        <span className="text-xs font-semibold">Category ID:</span>
                        <span className="text-xs">{category.id}</span>
                    </div>
                    <Link to="/admin/categorias" className="text-xs underline">Voltar</Link>
                </div>
                <Fieldset>
                    <InputItem type="hidden" name="id" defaultValue={category.id} />
                    <InputItem type="text" name="name" defaultValue={category.name} placeholder="Nome categoria" />
                </Fieldset>
                <Fieldset>
                    <Label htmlFor="visible" className="flex gap-2 items-center justify-end">
                        Visível
                        <Switch id="visible" name="visible" defaultChecked={category.visible} />
                    </Label>
                </Fieldset>
                <Fieldset>
                    <Label htmlFor="default" className="flex gap-2 items-center justify-end">
                        Padrão
                        <Switch id="default" name="default" defaultChecked={category.default} />
                    </Label>
                </Fieldset>
                <div className="flex gap-4">
                    <Button type="submit" variant="destructive" name="_action" value="category-delete" className="flex-1">
                        <Trash size={16} className="mr-2" />
                        Excluir
                    </Button>
                    <SubmitButton actionName={action} idleText={submitButtonIdleText} loadingText={submitButtonLoadingText} />

                </div>
            </Form>
        </div>

    )
}

function InputItem({ ...props }) {
    return (
        <Input className="text-lg p-2 placeholder:text-gray-400" {...props} autoComplete="nope" />
    )
}