import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import { cn } from "~/lib/utils";

interface FieldsetProps {
    children: React.ReactNode;
    clazzName?: string
    className?: string
}

export default function Fieldset({ children, clazzName, className }: FieldsetProps) {
    const formSubmissionState = useFormSubmissionnState()
    const formSubmissionInProgress = formSubmissionState === "submitting"

    return (
        <fieldset className={cn(
            "grid w-full max-w-sm md:max-w-lg items-center gap-1.5 mb-4",
            formSubmissionInProgress === true && "opacity-50",
            clazzName,
            className
        )}>
            {children}
        </fieldset>
    )
}