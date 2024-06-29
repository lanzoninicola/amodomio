import { Badge } from "~/components/ui/badge"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import MenuItemTagSelector from "./menu-item-tag-selector/menu-item-tag-selector"
import { MenuItemTag } from "@prisma/client"
import { Form } from "@remix-run/react"
import { jsonStringify } from "~/utils/json-helper"


interface MenuItemTagsProps {
    item: MenuItemWithAssociations
}
export default function MenuItemTags({ item }: MenuItemTagsProps) {
    return (
        <>
            <span className="font-semibold text-sm col-span-1">Tags</span>
            <div className="col-span-7 flex gap-4 border rounded-lg py-2 items-start ">

                <MenuItemTagSelector item={item} className="col-span-3" />
                <div className="flex gap-2 h-fit mt-2">
                    {item?.tags.filter(t => t.deletedAt === null).map(t =>
                        <BadgeTag key={t.id} item={item} tag={t} />)}
                </div>
            </div>
        </>
    )
}

function BadgeTag({ item, tag }: { item: MenuItemWithAssociations, tag: MenuItemTag }) {


    return (
        <Badge>
            <Form method="post">
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="tagName" value={tag.name} />
                <button type="submit" name="_action" value="menu-item-tag-remove" className="hover:underline">
                    {tag.name}
                </button>
            </Form>
        </Badge>
    )
}