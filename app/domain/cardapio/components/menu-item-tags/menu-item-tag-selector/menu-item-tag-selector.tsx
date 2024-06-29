import { MenuItemTag } from "@prisma/client"
import { Form, useLoaderData, useOutletContext, useSubmit } from "@remix-run/react"
import { useRef, useState } from "react"
import { Input } from "~/components/ui/input"
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server"
import { cn } from "~/lib/utils"
import { AdminCardapioOutletContext } from "~/routes/admin.gerenciamento.cardapio"
import type { HttpResponse } from "~/utils/http-response.server"
import { badRequest, ok } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"
import { MenuItemWithAssociations } from "../../../menu-item.prisma.entity.server"
import { jsonStringify } from "~/utils/json-helper"



interface MenuItemTagSelectorProps {
    item: MenuItemWithAssociations
    className?: React.HTMLAttributes<HTMLDivElement>["className"]
}

export default function MenuItemTagSelector({ item, className }: MenuItemTagSelectorProps) {
    const outletContext: AdminCardapioOutletContext = useOutletContext()
    const tags = outletContext?.tags || []

    const [searchedTag, setSearchedTag] = useState<string | null>(null)
    const [filteredTags, setFilteredTags] = useState<MenuItemTag[]>(tags)
    const [showList, setShowList] = useState(false)

    const submitButtonRef = useRef<HTMLButtonElement | null>(null);

    function addTag() {
        if (!submitButtonRef.current) return

        submitButtonRef.current.click()
    }


    return (
        <Form method="post" className={cn(
            "relative flex flex-col gap-2",
            className
        )}>
            <input type="hidden" name="item" value={jsonStringify(item)} />
            <Input name="tagName"
                className=" border-none"
                placeholder="Pesquisar tag..."
                value={searchedTag || ""}
                onChange={(e) => {

                    const value = e.target.value
                    setSearchedTag(value)

                    if (searchedTag?.length === 0) {
                        setShowList(false)
                        setFilteredTags(outletContext?.tags || [])
                        return
                    }

                    setShowList(true)
                    const tagsFound = filteredTags.filter(tag => tag.name.toLowerCase().includes(value.toLowerCase()))

                    if (tagsFound.length === 0) {
                        setShowList(false)
                        setFilteredTags([])
                        return
                    }

                    setFilteredTags(tagsFound)

                }} />
            {
                showList && (
                    <div className="absolute top-[55px] h-[150px] overflow-hidden w-[200px] z-10 ">
                        <div className=" border rounded-lg py-2 px-4 bg-white">
                            <ul className="flex flex-col gap-2">
                                {
                                    filteredTags.map(tag =>
                                        <li key={tag.id} className="text-sm cursor-pointer hover:underline"
                                            onClick={() => {
                                                setSearchedTag(tag.name)
                                                addTag()
                                                setShowList(false)
                                            }}
                                        >{tag.name}</li>
                                    )
                                }

                            </ul>
                        </div>
                    </div>
                )
            }
            <button ref={submitButtonRef} type="submit"
                className="hidden"
                name="action"
                value="menu-item-tag-add"></button>
        </Form>
    )
}
