import { Textarea, TextareaProps } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";


interface TextareaItemProps {
    className?: string;
    type: string;
    name: string;
    value?: string;
    defaultValue?: any
    placeholder?: string;
}

export default function TextareaItem({ className, type, ...props }: TextareaProps & TextareaItemProps) {
    return (
        <Textarea className={
            cn(
                "text-lg p-2 placeholder:text-gray-400",
                className
            )
        } {...props} autoComplete="nope" />
    )
}