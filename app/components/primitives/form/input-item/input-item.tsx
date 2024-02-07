import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface InputItemProps {
    ghost?: boolean,
    className?: string
    [x: string]: any,
}


export default function InputItem({ ghost, className, ...props }: InputItemProps) {
    return (
        <Input className={
            cn(
                `text-lg p-2 placeholder:text-gray-400`,
                ghost === true && "border-none focus-visible:ring-transparent",
                className
            )
        } {...props} autoComplete="nope" />
    )
}