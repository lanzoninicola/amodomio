import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"


interface FormLabelProps {
    disabled?: boolean
    children: React.ReactNode
    className?: string
}

export default function FormLabel({ disabled, children, className, ...props }: FormLabelProps & React.ComponentPropsWithoutRef<typeof Label>) {

    return (
        <Label {...props} className={
            cn(
                disabled && "cursor-not-allowed opacity-70",
                className
            )
        } >
            {children}
        </Label>
    )

}