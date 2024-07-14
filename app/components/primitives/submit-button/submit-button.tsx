import { Loader, Save } from "lucide-react";
import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import { cn } from "~/lib/utils";


interface SubmitButtonProps extends ButtonProps {
    actionName: string,
    showText?: boolean
    idleText?: string,
    loadingText?: string,
    disableLoadingAnimation?: boolean,
    onlyIcon?: boolean
    className?: string
    labelClassName?: string
    size?: "sm" | "lg" | "default" | null | undefined,
    icon?: JSX.Element
    iconColor?: string
}

export default function SubmitButton({
    actionName,
    showText = true,
    idleText,
    loadingText,
    disableLoadingAnimation,
    onlyIcon = false,
    className,
    size = "default",
    icon,
    iconColor,
    labelClassName,
    ...props
}: SubmitButtonProps) {

    const formSubmissionState = useFormSubmissionnState()
    let formSubmissionInProgress = formSubmissionState === "submitting"

    if (disableLoadingAnimation) {
        formSubmissionInProgress = false
    }

    let buttonIcon = formSubmissionInProgress ? <Loader size={16} color={iconColor || "white"} /> : <Save size={16} color={iconColor || "white"} />
    let text = formSubmissionInProgress ? (loadingText || "Salvando...") : (idleText || "Salvar")
    let disabled = formSubmissionInProgress || props.disabled

    buttonIcon = icon ? icon : buttonIcon


    return (
        <Button type="submit" name="_action" size="sm" value={actionName} disabled={disabled} {...props}
            className={
                cn(
                    `flex gap-2 w-full md:max-w-max md:px-8`,
                    className
                )
            } >
            {buttonIcon}
            {onlyIcon === false &&
                (<span className={
                    cn(
                        size === "sm" && "text-sm",
                        size === "lg" && "text-lg",
                        size === "default" && "text-md",
                        labelClassName
                    )
                }>
                    {showText === true && text}
                </span>)
            }
        </Button>
    )

}