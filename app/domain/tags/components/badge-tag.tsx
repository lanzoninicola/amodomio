import { Tag } from "@prisma/client"
import { X } from "lucide-react"
import { useState } from "react"
import Badge from "~/components/primitives/badge/badge"
import { cn } from "~/lib/utils"



interface BadgeTagProps {
    tag: Tag
    actionName?: string
    classNameLabel?: string
}

export default function BadgeTag({ tag, actionName, classNameLabel }: BadgeTagProps) {
    const [isHovered, setIsHovered] = useState(false)


    return (
        <Badge style={{ backgroundColor: tag.colorHEX || "black" }}>
            <div className="flex gap-3"
                onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                <span className={
                    cn(
                        tag.colorHEX || "text-white",
                        classNameLabel
                    )
                }>{tag.name}</span>
                {isHovered && <button type="submit" name="_action" value={actionName}>
                    <X size={12} />
                </button>}
            </div>
        </Badge>
    )
}