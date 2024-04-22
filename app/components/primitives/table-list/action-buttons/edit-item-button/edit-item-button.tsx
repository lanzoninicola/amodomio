import { Link } from "@remix-run/react";
import { Edit } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface EditItemButtonProps {
  to: string;
  label?: string
  labelClassName?: string
  variant?: "ghost" | "link" | "default" | "destructive" | "outline" | "secondary" | null | undefined
}

export default function EditItemButton({ variant = "ghost", to, label, labelClassName }: EditItemButtonProps) {
  return (
    <Tooltip content={label ? label : "Editar"}>
      <Link to={to} className="pl-4">

        <Button type="button" variant={variant} size="sm">
          <Edit size={16} />
          {label && <span className={
            cn(
              "pl-2 text-xs",
              labelClassName
            )
          }>{label}</span>}
        </Button>

      </Link>
    </Tooltip>
  );
}
