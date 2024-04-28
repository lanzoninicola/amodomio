import { RotateCw, Save, SaveIcon, Trash } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";
import { FormSubmissionnState } from "~/hooks/useFormSubmissionState";
import { cn } from "~/lib/utils";

interface SaveItemButtonProps {
    actionName: string;
    iconSize?: number;
    clazzName?: string
    className?: string
    // returned value of useFormSubmissionState() hook
    formSubmissionState?: FormSubmissionnState
    tooltipLabel?: string
    label?: string
    labelClassName?: string
    variant?: "ghost" | "link" | "default" | "destructive" | "outline" | "secondary" | null | undefined
    disabled?: boolean
}

export default function SaveItemButton({ variant = "ghost", actionName, iconSize = 16, clazzName, className, formSubmissionState, tooltipLabel = "Salvar", label, labelClassName, disabled }: SaveItemButtonProps) {
    return (
        <Tooltip content={tooltipLabel}>
            <Button type="submit" variant={variant} size="sm" name="_action" value={actionName}
                disabled={disabled}
                className={cn(
                    "text-black hover:bg-gray-200",
                    clazzName,
                    className
                )}>
                {formSubmissionState === "loading" || formSubmissionState === "submitting" ?
                    <RotateCw className="animate-spin" size={iconSize} /> :
                    <SaveIcon size={iconSize} />
                }
                {label && <span className={
                    cn(
                        "pl-2 text-xs",
                        labelClassName
                    )
                }>{label}</span>}
            </Button>
        </Tooltip>
    )
}