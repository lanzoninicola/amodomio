import { Form } from "@remix-run/react"
import React from "react"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"



interface MenuItemSwitchActivationProps {
    menuItem: MenuItemWithAssociations | undefined,
    active: boolean,
    setActive: React.Dispatch<React.SetStateAction<boolean>>
    showStatus?: boolean
    cnLabel?: string
    cnSubLabel?: string
    cnContainer?: string
}

export default function MenuItemSwitchActivation({
    menuItem,
    active, setActive,
    showStatus = true,
    cnLabel,
    cnSubLabel,
    cnContainer

}: MenuItemSwitchActivationProps) {
    const submitBtnRef = React.useRef<HTMLButtonElement>(null)

    function handleActivation() {

        setActive(!active)

        if (submitBtnRef.current) {
            submitBtnRef.current.click()
        }
    }

    return (
        <Form method="post" className={
            cn(
                "flex justify-between md:justify-end gap-2 w-full items-center col-span-2",
                cnContainer
            )
        }>


            <div className="flex flex-col gap-0">
                <span className={
                    cn(
                        "font-semibold text-sm text-red-500",
                        cnLabel
                    )
                }>Ativar</span>
                {
                    showStatus && (
                        <span className={
                            cn(
                                "text-[11px] text-red-400",
                                cnSubLabel
                            )
                        }>
                            Status: {menuItem?.active ? "Ativo" : "Não ativo"}
                        </span>
                    )
                }
            </div>
            <Switch defaultChecked={menuItem?.active || false} onCheckedChange={handleActivation} className="data-[state=checked]:bg-red-500" />
            <input type="hidden" name="id" value={menuItem?.id} />
            <button ref={submitBtnRef} className="hidden" type="submit" value={"menu-item-activation-change"} name="_action" />

        </Form>
    )
}

/**
 * if (_action === "menu-item-visibility-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            active: !item.active
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.active === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

        return ok(returnedMessage);
    }
 */