import { Badge } from "~/components/ui/badge"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import MenuItemTagSelector from "./menu-item-tag-selector/menu-item-tag-selector"
import { MenuItemTag } from "@prisma/client"
import { Form, useFetcher, useSubmit } from "@remix-run/react"
import { jsonStringify } from "~/utils/json-helper"
import { useState } from "react"


interface MenuItemTagsProps {
    item: MenuItemWithAssociations
}
export default function MenuItemTags({ item }: MenuItemTagsProps) {

    const [currentTags, setCurrentTags] = useState(item?.tags || [])


    function removeTag(itemId: string, name: string) {
        const nextTags = currentTags.slice(currentTags.findIndex(t => t.name === name && t.menuItemId === itemId), 1)
        setCurrentTags(nextTags)
    }

    function addTag(tag: MenuItemTag) {
        setCurrentTags([...currentTags, tag])
    }

    return (
        <>
            <span className="font-semibold text-sm col-span-1">Tags</span>
            <div className="col-span-7 flex gap-4 border rounded-lg py-2 items-start ">

                <MenuItemTagSelector item={item} className="col-span-3" />
                <div className="flex gap-2 h-fit mt-2">
                    {currentTags.filter(t => t.deletedAt === null).map(t =>
                        <BadgeTag key={t.id} item={item} tag={t} removeTag={removeTag} />)}
                </div>
            </div>
        </>
    )
}

interface BadgeTagProps {
    item: MenuItemWithAssociations
    tag: MenuItemTag
    removeTag: (itemId: string, name: string) => void
}

function BadgeTag({ item, tag, removeTag }: BadgeTagProps) {

    const fetcher = useFetcher()

    return (
        <Badge>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="tagName" value={tag.name} />
            <button type="submit" name="_action"
                value="menu-item-tag-remove"
                className="hover:underline"
                onClick={() => {

                    removeTag(item.id, tag.name)

                    fetcher.submit({
                        tagName: tag.name,
                        itemId: item.id,
                        _action: "menu-item-tag-remove",
                    }, { replace: true })
                }}
            >
                {tag.name}
            </button>
        </Badge>
    )
}