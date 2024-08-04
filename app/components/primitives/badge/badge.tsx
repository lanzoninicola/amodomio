import { cn } from "~/lib/utils"

interface BadgeProps {
    className?: string
    style?: React.CSSProperties
    children: React.ReactNode
}

export default function Badge({ className, style, children }: BadgeProps) {

    return (
        <div className={
            cn(
                "px-4 py-1 rounded-full text-xs text-gray-800 font-semibold tracking-wide max-w-max",
                className,
            )
        }
            style={{
                ...style
            }}
        >
            {children}
        </div>
    )
}