import { Award } from "lucide-react";
import { cn } from "~/lib/utils";


interface AwardBadgeProps {
    children?: React.ReactNode
    cnContainer?: string
}


export default function AwardBadge({ children, cnContainer }: AwardBadgeProps) {

    return (
        <div className={
            cn(
                "flex gap-2 items-center px-2 py-1 w-fit",
                cnContainer || "bg-yellow-200 text-black"
            )
        }>
            <Award size={16} />
            <p className="font-neue uppercase tracking-wider leading-none text-xs font-[500]">
                {children}
            </p>
        </div>
    )

}