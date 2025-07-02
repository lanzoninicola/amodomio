import { Tag } from "@prisma/client";
import { Star, X } from "lucide-react";
import { cn } from "~/lib/utils";

interface BadgeTagProps {
    tag: Tag;
    tagColor?: boolean;
    actionName?: string;
    classNameContainer?: string;
    classNameLabel?: string;
    cnStar?: string;
    allowRemove?: boolean;
}

function isDarkColor(hex: string): boolean {
    const hexClean = hex.replace("#", "");
    const r = parseInt(hexClean.substring(0, 2), 16);
    const g = parseInt(hexClean.substring(2, 4), 16);
    const b = parseInt(hexClean.substring(4, 6), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance < 128;
}

export default function BadgeTag({
    tag,
    tagColor = true,
    actionName,
    classNameContainer,
    classNameLabel,
    cnStar,
    allowRemove = true,
}: BadgeTagProps) {
    const textColor = isDarkColor(tag.colorHEX) ? "text-white" : "text-black";
    const highlightFeatured = tag.featuredFilter === true;

    return (
        <div
            className={cn(
                "relative flex items-center px-4 py-1 rounded-md transition-colors duration-200 group cursor-pointer",
                tag.colorHEX === "#FFFFFF" && "border border-black",
                classNameContainer
            )}
            style={tagColor ? { backgroundColor: tag.colorHEX } : undefined}
        >
            {highlightFeatured && (
                <Star
                    size={16}
                    className={cn("mr-1 text-yellow-500 animate-ping-slow fill-yellow-500", cnStar)}
                />
            )}

            <span
                className={cn(
                    "text-sm font-medium leading-none truncate",
                    textColor,
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
                    aria-label={`Remover tag ${tag.name}`}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}
