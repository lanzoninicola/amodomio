import { Link } from "@remix-run/react";
import { Edit } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface EditItemButtonProps {
  to: string;
  label?: string
}

export default function EditItemButton({ to, label }: EditItemButtonProps) {
  return (
    <Tooltip content={label ? label : "Editar"}>
      <Link to={to} className="pl-4">
        <div className={
          cn(
            "flex gap-0 items-center justify-between",
            label && "min-w-[110px]"
          )
        }>
          {label && <span className="text-xs">{label}</span>}
          <Button type="button" variant={"ghost"} size="sm">
            <Edit size={16} />
          </Button>
        </div>
      </Link>
    </Tooltip>
  );
}
