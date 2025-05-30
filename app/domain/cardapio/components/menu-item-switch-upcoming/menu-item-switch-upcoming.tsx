import { Form } from "@remix-run/react"
import React from "react"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"



interface MenuItemSwitchUpcomingProps {
  upcoming: boolean,
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
  cnContainer?: string
  cnLabel?: string
  cnSubLabel?: string
}

export default function MenuItemSwitchUpcomingSubmit({ upcoming, cnContainer, cnLabel }: MenuItemSwitchUpcomingProps) {
  return (
    <div className={
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
      <Switch defaultChecked={upcoming || false} name="upcoming" />

    </div>
  )
}
