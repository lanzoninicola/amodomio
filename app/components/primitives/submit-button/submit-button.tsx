import { Loader, Save } from "lucide-react";
import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import { cn } from "~/lib/utils";


interface SubmitButtonProps extends ButtonProps {
    actionName: string,
    loadingText?: string,
    idleText?: string,
    disableLoadingAnimation?: boolean,
    onlyIcon?: boolean
    className?: string
    size?: "sm" | "lg" | "default" | null | undefined,
    icon?: JSX.Element
}

export default function SubmitButton({
    actionName,
    loadingText,
    idleText,
    disableLoadingAnimation,
    onlyIcon = false,
    className,
    size = "default",
    icon,
    ...props
}: SubmitButtonProps) {

    const formSubmissionState = useFormSubmissionnState()
    let formSubmissionInProgress = formSubmissionState === "submitting"

    if (disableLoadingAnimation) {
        formSubmissionInProgress = false
    }

    let buttonIcon = formSubmissionInProgress ? <Loader size={16} /> : <Save size={16} />
    let text = formSubmissionInProgress ? (loadingText || "Salvando...") : (idleText || "Salvar")
    let disabled = formSubmissionInProgress || props.disabled

    buttonIcon = icon ? icon : buttonIcon


    return (
        <Button type="submit" name="_action" value={actionName} disabled={disabled} {...props}
            className={
                cn(
                    `flex gap-2 w-full md:max-w-max md:px-8 md:py`,
                    className
                )
            } >
            {buttonIcon}
            {onlyIcon === false &&
                (<span className={
                    cn(
                        size === "sm" && "text-sm",
                        size === "lg" && "text-lg",
                        size === "default" && "text-md"
                    )
                }>
                    {text}
                </span>)
            }
        </Button>
    )

}