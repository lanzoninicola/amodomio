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
}

export default function SaveItemButton({ actionName, iconSize = 16, clazzName, className, formSubmissionState, tooltipLabel = "Salvar" }: SaveItemButtonProps) {
    return (
        <Tooltip content={tooltipLabel}>
            <Button type="submit" variant={"ghost"} size="sm" name="_action" value={actionName}
                className={cn(
                    "text-black hover:bg-gray-200",
                    clazzName,
                    className
                )}>
                {formSubmissionState === "loading" || formSubmissionState === "submitting" ?
                    <RotateCw className="animate-spin" size={iconSize} /> :
                    <SaveIcon size={iconSize} />
                }
            </Button>
        </Tooltip>
    )
}