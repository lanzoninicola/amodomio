import { Link } from "@remix-run/react";
import { Delete, Trash } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";


interface DeleteItemButtonProps {
  actionName: string;
  iconSize?: number;
  className?: string;
  label?: string
  labelClassName?: string
  variant?: "ghost" | "link" | "default" | "destructive" | "outline" | "secondary" | null | undefined
}

export default function DeleteItemButton({ variant = "ghost", actionName, iconSize, className, label, labelClassName }: DeleteItemButtonProps) {
  return (
    <Tooltip content={label ? label : "Deletar"}>
      <div className={
        cn(
          "flex gap-0 items-center justify-between",
        )
      }>
        <Button type="submit" variant={variant} size="sm" name="_action" value={actionName} className={
          cn(
            "text-red-500 hover:bg-red-200",
            className
          )
        }>
          <Trash size={iconSize || 16} />
          {label && <span className={
            cn(
              "pl-2 text-xs",
              labelClassName
            )
          }>{label}</span>}
        </Button>

      </div>
    </Tooltip>

  )
}


// export default function DeleteItemButton() {
//   return (dddddddddddddddddddd
//     <button
//       type="submit"
//       className="text-red-500 flex gap-4 items-center"
//       title="Eliminar"
//       name="_action"
//       value="delete"
//     >
//       <Delete size={"16"} />
//       <span className="font-md">Eliminar</span>
//     </button>
//   );
// }
