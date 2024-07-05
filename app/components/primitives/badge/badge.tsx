import { cn } from "~/lib/utils"

interface BadgeProps {
    className?: string
    children: React.ReactNode
}

export default function Badge({ className, children }: BadgeProps) {

    return (
        <span className={
            cn(
                "px-4 py-1 rounded-full text-xs text-gray-800 font-semibold tracking-wide max-w-max",
                className,
            )
        }>
            {children}
        </span>
    )
}