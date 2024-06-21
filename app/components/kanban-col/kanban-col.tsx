import { HelpCircle } from "lucide-react"
import { useState } from "react"
import { cn } from "~/lib/utils"

interface KanbanColProps {
    children: React.ReactNode
    title: string
    description: string
    className?: string
    severity: number
    itemsNumber?: number
}

export default function KanbanCol({ children, title, description, className, severity = 1, itemsNumber, ...props }: KanbanColProps) {

    const [showDescription, setShowDescription] = useState(false)

    const severityBgCol: Record<number, string> = {
        1: "bg-slate-50",
        2: "bg-orange-100",
        3: "bg-orange-200",
        4: "bg-red-300",
        5: "bg-red-400"
    }

    const severityBgOrderNumber: Record<number, string> = {
        1: "bg-slate-200",
        2: "bg-orange-200",
        3: "bg-orange-400",
        4: "bg-red-400",
        5: "bg-red-500"
    }

    return (
        <div className={
            cn(
                `flex flex-col gap-4 p-2 rounded-sm`,
                className,
            )
        } {...props}>
            <div className={
                cn(
                    "flex gap-2 items-center justify-between p-2 rounded-sm",
                    severityBgCol[severity],
                )
            }>
                <div className="flex flex-col gap-2">
                    <span className="font-semibold text-sm">{title}</span>
                    <div className="flex gap-2 items-center">

                        <span className="text-xs underline cursor-pointer" onClick={() => setShowDescription(!showDescription)}>
                            {showDescription ? 'Esconder' : 'Ver mais'}
                        </span>
                        <HelpCircle size={16} />

                    </div>
                    {showDescription && <span>{description}</span>}
                </div>
                <div className={
                    cn(
                        "grid place-items-center rounded-md h-12 w-12",
                        // severityBgOrderNumber[severity],
                    )
                }>
                    <span className="text-4xl font-semibold">{itemsNumber}</span>
                </div>
            </div>

            {children}

        </div>
    )
}