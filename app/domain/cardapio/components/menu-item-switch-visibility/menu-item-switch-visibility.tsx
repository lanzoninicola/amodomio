import { Form } from "@remix-run/react"
import React from "react"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"



interface MenuItemSwitchVisibilityProps {
    menuItem: MenuItemWithAssociations | undefined,
    showStatus?: boolean
    cnContainer?: string
    cnLabel?: string
    cnSubLabel?: string
}

export default function MenuItemSwitchVisibility({ menuItem, cnContainer, showStatus = true, cnLabel, cnSubLabel }: MenuItemSwitchVisibilityProps) {
    const submitBtnRef = React.useRef<HTMLButtonElement>(null)

    function handleVisibility() {
        if (submitBtnRef.current) {
            submitBtnRef.current.click()
        }
    }

    return (
        <Form method="post" className={
            cn(
                "grid grid-cols-2 md:justify-end gap-2 w-full items-center col-span-2",
                cnContainer
            )
        }>


            <div className="flex flex-col gap-0">
                <span className={
                    cn(
                        "font-semibold text-sm",
                        cnLabel
                    )
                }>Ativar venda</span>
                {
                    showStatus && (
                        <span className={
                            cn(
                                "text-[11px] text-muted-foreground",
                                cnSubLabel
                            )
                        }>
                            Status: {menuItem?.visible ? "Ativado" : "Pausado"}
                        </span>
                    )
                }
            </div>
            <Switch defaultChecked={menuItem?.visible || false} onCheckedChange={handleVisibility} />
            <input type="hidden" name="id" value={menuItem?.id} />
            <button ref={submitBtnRef} className="hidden" type="submit" value={"menu-item-visibility-change"} name="_action" />

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
            visible: !item.visible
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.visible === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

        return ok(returnedMessage);
    }
 */