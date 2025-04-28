import { Loader, Save } from "lucide-react";
import { Ref, forwardRef } from "react";
import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import useFormSubmissionState from "~/hooks/useFormSubmissionState";
import { cn } from "~/lib/utils";

interface SubmitButtonProps extends ButtonProps {
    actionName: string;
    showText?: boolean;
    idleText?: string;
    loadingText?: string;
    disableLoadingAnimation?: boolean;
    onlyIcon?: boolean;
    hideIcon?: boolean;
    size?: "sm" | "lg" | "default" | null | undefined;
    icon?: JSX.Element;
    iconColor?: string;
    className?: string;
    labelClassName?: string;
    cnContainer?: string;
    cnLabel?: string;
    cnIcon?: string;
}

const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(({
    actionName,
    showText = true,
    idleText = "Salvar",
    loadingText = "Salvando...",
    disableLoadingAnimation = false,
    onlyIcon = false,
    hideIcon = false,
    size = "default",
    icon,
    iconColor = "white",
    className,
    labelClassName,
    cnContainer,
    cnLabel,
    cnIcon,
    ...props
}, ref: Ref<HTMLButtonElement>) => {

    const formSubmissionState = useFormSubmissionState();
    const formSubmissionInProgress = !disableLoadingAnimation && formSubmissionState === "submitting";

    // Define qual ícone usar
    const defaultIcon = formSubmissionInProgress
        ? <Loader size={16} color={iconColor} className={cn(cnIcon)} />
        : <Save size={16} color={iconColor} className={cn(cnIcon)} />;

    const buttonIcon = icon || defaultIcon;

    // Define o texto do botão
    const buttonText = formSubmissionInProgress ? loadingText : idleText;

    const disabled = formSubmissionInProgress || props.disabled;

    return (
        <Button
            type="submit"
            name="_action"
            value={actionName}
            size="sm"
            ref={ref}
            disabled={disabled}
            {...props}
            className={cn(
                "flex items-center w-full md:max-w-max",
                (hideIcon || onlyIcon) ? "" : "gap-2",
                "md:px-8",
                className,
                cnContainer,
            )}
        >
            {/* Ícone */}
            {!hideIcon && buttonIcon}

            {/* Texto */}
            {!onlyIcon && (
                <span
                    className={cn(
                        size === "sm" && "text-sm",
                        size === "lg" && "text-lg",
                        size === "default" && "text-md",
                        labelClassName,
                        cnLabel,
                    )}
                >
                    {showText && buttonText}
                </span>
            )}
        </Button>
    );
});

SubmitButton.displayName = "SubmitButton"; // Boa prática para componentes com forwardRef

export default SubmitButton;
