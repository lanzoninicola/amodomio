import { Tag } from "@prisma/client";
import { Star, X } from "lucide-react";
import Badge from "~/components/primitives/badge/badge";
import { cn } from "~/lib/utils";

interface BadgeTagProps {
    tag: Tag;
    tagColor?: boolean;
    actionName?: string;
    classNameContainer?: string;
    classNameLabel?: string;
    allowRemove?: boolean;
}

export default function BadgeTag({
    tag,
    tagColor = true,
    actionName,
    classNameContainer,
    classNameLabel,
    allowRemove = true,
}: BadgeTagProps) {
    const style = tagColor ? { backgroundColor: tag.colorHEX } : undefined;

    return (
        <div
            className={cn(
                "cursor-pointer flex px-4 py-1 items-center rounded-md group transition-colors duration-200",
                tag.colorHEX === "#FFFFFF" && "border border-black",
                classNameContainer
            )}
            style={style}
        >
            {tag.featuredFilter === true && <Star size={14} className="mr-1" />}
            <span
                className={cn(
                    tag.colorHEX || "text-white",
                    tag.colorHEX === "#000000" && "text-white",
                    classNameLabel
                )}
            >
                {tag.name}
            </span>

            {allowRemove && (
                <button
                    type="submit"
                    name="_action"
                    value={actionName}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}
