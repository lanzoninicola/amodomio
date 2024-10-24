import { cn } from "~/lib/utils"


interface HelixLoaderIconProps {
    className?: string
}

export default function HelixLoaderIcon({ className }: HelixLoaderIconProps) {
    return (
        <div aria-live="polite" aria-busy={true} className={
            cn(
                className
            )
        }>
            <l-helix
                size="45"
                speed="2.5"
                color="#111111"
            ></l-helix>
        </div>
    )
}