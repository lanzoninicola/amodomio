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
                "flex gap-2 items-center  px-2 py-0 w-fit",
                cnContainer || "bg-yellow-200 text-black"
            )
        }>
            <Award size={17} />
            <span className="font-body-website uppercase tracking-wide">
                {children}
            </span>
        </div>
    )

}