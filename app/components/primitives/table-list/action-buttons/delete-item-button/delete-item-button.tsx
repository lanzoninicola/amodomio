import { Link } from "@remix-run/react";
import { Delete, Trash } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";


interface DeleteItemButtonProps {
  actionName: string;
  iconSize?: number;
  className?: string;
}

export default function DeleteItemButton({ actionName, iconSize, className }: DeleteItemButtonProps) {
  return (
    <Tooltip content="Deletar">
      <Button type="submit" variant={"ghost"} size="sm" name="_action" value={actionName} className={
        cn(
          "text-red-500 hover:bg-red-200",
          className
        )
      }>
        <Trash size={iconSize || 16} />
      </Button>
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
