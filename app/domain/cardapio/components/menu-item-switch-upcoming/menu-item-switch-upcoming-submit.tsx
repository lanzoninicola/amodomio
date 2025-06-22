import { Form } from "@remix-run/react"
import React from "react"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"



interface MenuItemSwitchUpcomingSubmitProps {
  menuItem: MenuItemWithAssociations | undefined,
  cnContainer?: string
  cnLabel?: string
  cnSubLabel?: string
}

/**
 *  NOTE: To work properly, this component need an action handler in the route that uses it.
 */

export default function MenuItemSwitchUpcomingSubmit({ menuItem, cnContainer, cnLabel }: MenuItemSwitchUpcomingSubmitProps) {
  const submitBtnRef = React.useRef<HTMLButtonElement>(null)

  function handleUpcoming() {

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
        }>Futuro lançamento</span>

      </div>
      <Switch defaultChecked={menuItem?.upcoming || false} onCheckedChange={handleUpcoming} />
      <input type="hidden" name="id" value={menuItem?.id} />
      <button ref={submitBtnRef} className="hidden" type="submit" value={"menu-item-upcoming-change"} name="_action" />

    </Form>
  )
}

/**
 * if (_action === "menu-item-upcoming-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            upcoming: !item.upcoming
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.upcoming === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

        return ok(returnedMessage);
    }
 */