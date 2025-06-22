import { Category, MenuItemGroup } from "@prisma/client"
import { Form } from "@remix-run/react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import formatStringList from "~/utils/format-string-list"
import { cn } from "~/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DeleteItemButton } from "~/components/primitives/table-list"
import { Label } from "~/components/ui/label"
import { useRef, useState } from "react"
import Fieldset from "~/components/ui/fieldset"
import { Textarea } from "~/components/ui/textarea"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import useSaveShortcut from "~/hooks/use-save-shortcut.hook"
import { jsonStringify } from "~/utils/json-helper"
import MenuItemSwitchVisibilitySubmit from "../menu-item-switch-visibility/menu-item-switch-visibility-submit"
import { Alert } from "~/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { LoggedUser } from "~/domain/auth/types.server"
import MenuItemSwitchUpcoming from "../menu-item-switch-upcoming/menu-item-switch-upcoming"


export type MenuItemFormAction = "menu-item-create" | "menu-item-update"

interface MenuItemFormProps {
    item?: MenuItemWithAssociations
    categories?: Category[]
    groups: MenuItemGroup[]
    action: MenuItemFormAction
    className?: string
    loggedUser?: LoggedUser
}

export default function MenuItemForm({ item, action, className, categories, groups, loggedUser }: MenuItemFormProps) {
    const [currentBasePrice, setCurrentBasePrice] = useState(item?.basePriceAmount || 0)


    const submitButtonRef = useRef<any>()
    useSaveShortcut({ callback: submitForm })

    function submitForm() {
        if (!submitButtonRef.current) return
        submitButtonRef.current.click()
    }


    return (

        <div className="flex flex-col">
            {
                item?.visible === false && item?.active === true
                && (
                    <Alert className="mb-4 border-orange-400">
                        <AlertCircle size={16} className="mr-2 " color="orange" />
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-orange-400">Sabor pausado</span>
                            <span className="text-xs text-orange-300">Esse sabor está pausado e não será exibido no cardápio</span>
                        </div>
                    </Alert>
                )
            }

            {
                item?.active === false && (
                    <Alert className="mb-4" variant={"destructive"}>
                        <AlertCircle size={16} className="mr-2" />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold uppercase tracking-wide">Sabor excluido</span>
                            <span className="text-xs">Esse sabor foi excluido do cardápio</span>
                        </div>
                    </Alert>
                )
            }

            <Form method="post" className={cn(
                className,
                item?.active === false && "opacity-50 pointer-events-none",
            )}  >

                <input type="hidden" name="id" value={item?.id} />

                <section className="flex flex-col gap-4 md:grid md:grid-cols-8 md:gap-x-4 items-center w-full ">
                    <Input type="text" name="name" defaultValue={item?.name}
                        placeholder="Nome da pizza"
                        className="font-semibold tracking-tight col-span-3" />
                    <MenuItemSwitchUpcoming
                        upcoming={item?.upcoming || false}
                        setVisible={() => { }}
                        cnContainer="col-span-2"
                        cnLabel="text-sm"
                        cnSubLabel="text-xs"
                    />

                    <MenuItemSwitchVisibilitySubmit
                        menuItem={item}
                        visible={item?.visible || false}
                        setVisible={() => { }}
                        cnContainer="col-span-2"
                        cnLabel="text-sm"
                        cnSubLabel="text-xs"
                    />

                </section>


                <Separator className="my-8" />

                <section className="md:grid md:grid-cols-8 justify-between gap-x-2">
                    <div className="flex flex-col col-span-4">
                        <input type="hidden" name="id" value={item?.id || ""} />

                        <Fieldset>
                            <Textarea name="ingredients"
                                placeholder="Ingredientes"
                                defaultValue={formatStringList(item?.ingredients, { firstLetterCapitalized: true })}
                                className={cn(
                                    "text-sm col-span-4",
                                    action === "menu-item-create" && "border",
                                    // action === "menu-item-update" && "border-none focus:px-2 p-0"
                                )} />
                        </Fieldset>

                        <Fieldset className="grid grid-cols-4 items-center" >
                            <div className="flex flex-col gap-0">
                                <Label className="font-semibold text-sm col-span-1">Preço Base</Label>
                                <span className="text-xs text-muted-foreground">(Tamanho Medio)</span>
                            </div>
                            <Input type="text" name="basePriceAmount"
                                onChange={(e) => {
                                    const value = e.target.value
                                    if (isNaN(Number(value))) return

                                    setCurrentBasePrice(Number(value))
                                }}
                                defaultValue={item?.basePriceAmount || "0"}
                                className={
                                    cn(
                                        "text-xs md:text-sm col-span-1",
                                        action === "menu-item-create" && "border",
                                        action === "menu-item-update" && "p-0 border-none focus:px-2"
                                    )
                                } />
                        </Fieldset>

                    </div>



                </section>

                <Separator className="my-4" />

                <section className="flex flex-col gap-2 md:grid md:grid-cols-2">

                    <Select name="group" defaultValue={JSON.stringify(item?.MenuItemGroup)} >
                        <SelectTrigger className="text-xs uppercase tracking-wide" >
                            <SelectValue placeholder="Grupo" />
                        </SelectTrigger>
                        <SelectContent id="group" >
                            <SelectGroup >
                                {groups && groups.map(g => {
                                    return (
                                        <SelectItem key={g.id} value={JSON.stringify(g)} className="text-lg">{g.name}</SelectItem>
                                    )
                                })}
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Select name="category" defaultValue={JSON.stringify(item?.Category)} >
                        <SelectTrigger className="text-xs  uppercase tracking-wide" >
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent id="category" >
                            <SelectGroup >
                                {categories && categories.map(category => {
                                    return (
                                        <SelectItem key={category.id} value={JSON.stringify(category)} className="text-lg">{category.name}</SelectItem>
                                    )
                                })}
                            </SelectGroup>
                        </SelectContent>
                    </Select>




                </section>

                <Separator className="my-4" />

                <section className="flex flex-col">
                    <Fieldset className="grid grid-cols-4 items-center">
                        <Label htmlFor="mogoId" className="font-semibold text-sm col-span-1">Mogo ID</Label>
                        <Input type="text" id="mogoId" name="mogoId"
                            placeholder="ID produto mogo"
                            defaultValue={item?.mogoId}
                            className={cn(
                                "text-xs md:text-sm col-span-3",
                                action === "menu-item-create" && "border",
                                action === "menu-item-update" && "border-none focus:px-2 p-0"
                            )} />
                    </Fieldset>


                </section>

                <Separator className="my-4" />

                <Fieldset className="grid grid-cols-4 items-center">
                    <Label htmlFor="notesPublic" className="font-semibold text-sm col-span-1">Observações publicas</Label>
                    <Textarea id="notesPublic" name="notesPublic"
                        placeholder="Adicione observações publicas..."
                        defaultValue={item?.notesPublic || ""}
                        className={cn(
                            "text-xs md:text-sm col-span-3",
                            action === "menu-item-create" && "border",
                            action === "menu-item-update" && "border-none focus:px-2"
                        )}
                    />
                </Fieldset>

                <Separator className="my-4" />

                <div className="flex gap-4 justify-end">

                    <SubmitButton ref={submitButtonRef} actionName={action} labelClassName="text-xs" variant={"outline"} tabIndex={0} iconColor="black" />
                    {action === "menu-item-update" && (
                        <DeleteItemButton actionName="menu-item-soft-delete" label="Inativar" />
                    )}
                    <input type="hidden" name="loggedUser" value={jsonStringify(loggedUser)} />
                </div>
            </Form>

        </div>

    )
}






