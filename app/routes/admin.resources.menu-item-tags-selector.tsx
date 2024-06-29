import { MenuItemTag } from "@prisma/client"
import { useLoaderData } from "@remix-run/react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { menuItemTagPrismaEntity } from "~/domain/menu-item/menu-item-tags.prisma.entity.server"
import type { HttpResponse } from "~/utils/http-response.server"
import { badRequest, ok } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"

export async function loader() {

    const [err, tags] = await tryit(menuItemTagPrismaEntity.findAllDistinct())

    if (err) {
        return badRequest(err)
    }

    return ok({ tags })
}

interface MenuItemTagSelectorProps {
    defaultValue?: string,
    clazzName?: React.HTMLAttributes<HTMLDivElement>["className"]
}

export function MenuItemTagSelector({ defaultValue, clazzName }: MenuItemTagSelectorProps) {
    const loaderData: HttpResponse | null = useLoaderData<typeof loader>()
    let tags: MenuItemTag[] = loaderData?.payload.tags || []

    console.log(loaderData)

    if (loaderData?.status > 399) {
        tags = []
    }


    return (
        <Select name="tag" defaultValue={defaultValue} required>
            <SelectTrigger>
                <SelectValue placeholder="Seleçionar tag" className="text-xs text-muted" />
            </SelectTrigger>
            <SelectContent className={clazzName}>
                <SelectGroup>
                    {tags && tags.map(t => {

                        if (t?.id === undefined) {
                            return null
                        }

                        return (
                            <SelectItem key={t.id} value={t.id}>
                                {t.tag}
                            </SelectItem>
                        )

                    })}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}