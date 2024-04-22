import { Link } from "@remix-run/react";
import { PlusSquare } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface LinkButtonProps {
    to: string
    iconSize?: number;
    className?: string
    tooltipLabel?: string
    label: string
    labelClassName?: string
    children?: React.ReactNode
}

export default function LinkButton({ to, iconSize = 16, className, tooltipLabel = "Tooltip", label, labelClassName, children }: LinkButtonProps) {
    return (
        <Tooltip content={tooltipLabel}>
            <Link to={to} className={cn(
                "inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:text-accent-foreground h-9 px-3 rounded-md text-black hover:bg-gray-200",
                className
            )}>
                {children}
                {label && <span className={
                    cn(
                        "pl-2 text-sm",
                        labelClassName
                    )
                }>{label}</span>}
            </Link>
        </Tooltip>
    )
}