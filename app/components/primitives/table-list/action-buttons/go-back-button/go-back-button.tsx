import { useNavigate } from "@remix-run/react";
import { RotateCcw, RotateCw, Save, SaveIcon, Trash } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";
import { FormSubmissionnState } from "~/hooks/useFormSubmissionState";
import { cn } from "~/lib/utils";

interface GoBackButtonProps {
    iconSize?: number;
    clazzName?: string
    className?: string
    tooltipLabel?: string
    label?: string
    labelClassName?: string
    variant?: "ghost" | "link" | "default" | "destructive" | "outline" | "secondary" | null | undefined
}

export default function GoBackButton({ variant = "ghost", iconSize = 16, clazzName, className, tooltipLabel = "Voltar", label = "Voltar", labelClassName }: GoBackButtonProps) {
    const navigate = useNavigate()
    const goBack = () => navigate(-1)

    return (
        <Tooltip content={tooltipLabel}>
            <Button variant={variant} size="sm"
                onClick={goBack}
                className={cn(
                    "text-black hover:bg-gray-200",
                    clazzName,
                    className
                )}>
                <RotateCcw size={16} />
                {label && <span className={
                    cn(
                        "pl-2 text-sm",
                        labelClassName
                    )
                }>{label}</span>}

            </Button>
        </Tooltip>
    )
}