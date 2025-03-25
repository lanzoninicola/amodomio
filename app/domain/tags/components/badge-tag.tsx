import { Tag } from "@prisma/client"
import { X } from "lucide-react"
import { useState } from "react"
import Badge from "~/components/primitives/badge/badge"
import { cn } from "~/lib/utils"



interface BadgeTagProps {
    tag: Tag
    tagColor?: boolean
    actionName?: string
    classNameContainer?: string
    classNameLabel?: string
    allowRemove?: boolean
}

export default function BadgeTag({ tag, tagColor = true, actionName, classNameContainer, classNameLabel, allowRemove = true }: BadgeTagProps) {
    const [isHovered, setIsHovered] = useState(false)


    let props = {}

    if (tagColor) {
        props = {
            ...props,
            style: {
                backgroundColor: tag.colorHEX
            }
        }
    }



    return (
        <div className={
            cn(
                "cursor-pointer flex px-4 py-1 items-center rounded-md",
                tag.colorHEX === "#FFFFFF" && "border border-black",
                classNameContainer
            )
        } {...props}
            onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <span className={
                cn(
                    tag.colorHEX || "text-white",
                    tag.colorHEX === "#000000" && "text-white",
                    classNameLabel
                )
            }>{tag.name}</span>
            {
                allowRemove && isHovered && <button type="submit" name="_action" value={actionName} className="ml-2 hover:opacity-50">
                    <X size={12} />
                </button>
            }
        </div>
    )
}