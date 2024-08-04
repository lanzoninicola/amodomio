import { Tag } from "@prisma/client"
import { X } from "lucide-react"
import { useState } from "react"
import Badge from "~/components/primitives/badge/badge"



interface BadgeTagProps {
    tag: Tag
    actionName?: string
}

export default function BadgeTag({ tag, actionName }: BadgeTagProps) {
    const [isHovered, setIsHovered] = useState(false)


    return (
        <Badge className="w-fit" style={{ backgroundColor: tag.colorHEX || "black" }}>
            <div className="flex gap-3"
                onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                <span>{tag.name}</span>
                {isHovered && <button type="submit" name="_action" value={actionName}>
                    <X size={12} />
                </button>}
            </div>
        </Badge>
    )
}