import { Loader, Save } from "lucide-react";
import { Ref, forwardRef } from "react";
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
    cnContainer?: string
    cnLabel?: string
    cnIcon?: string
}

const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(({
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
    cnContainer,
    cnLabel,
    cnIcon,
    ...props
}, ref: Ref<HTMLButtonElement>) => {

    const formSubmissionState = useFormSubmissionnState();
    let formSubmissionInProgress = formSubmissionState === "submitting";

    if (disableLoadingAnimation) {
        formSubmissionInProgress = false;
    }

    let buttonIcon = formSubmissionInProgress ?
        <Loader size={16} color={iconColor || "white"} className={cn(cnIcon)} /> :
        <Save size={16} color={iconColor || "white"} className={cn(cnIcon)} />;
    let text = formSubmissionInProgress ? (loadingText || "Salvando...") : (idleText || "Salvar");
    let disabled = formSubmissionInProgress || props.disabled;

    buttonIcon = icon ? icon : buttonIcon;

    return (
        <Button
            type="submit"
            name="_action"
            size="sm"
            value={actionName}
            disabled={disabled}
            ref={ref}
            {...props}
            className={cn(
                `flex gap-2 w-full md:max-w-max md:px-8`,
                className,
                cnContainer,
            )}
        >
            {buttonIcon}
            {onlyIcon === false &&
                (<span className={cn(
                    size === "sm" && "text-sm",
                    size === "lg" && "text-lg",
                    size === "default" && "text-md",
                    labelClassName,
                    cnLabel,
                )}>
                    {showText === true && text}
                </span>)
            }
        </Button>
    );
});

export default SubmitButton;
