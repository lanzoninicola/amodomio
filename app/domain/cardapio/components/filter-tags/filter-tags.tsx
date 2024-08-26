import { Tag } from "@prisma/client"
import { Link, useSearchParams } from "@remix-run/react"
import { Filter } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import BadgeTag from "~/domain/tags/components/badge-tag"
import { cn } from "~/lib/utils"

export default function FiltersTags({ tags }: { tags: Tag[] }) {

    const [searchParams, setSearchParams] = useSearchParams()
    const tagFilter = searchParams.get("tag")

    return (

        <div className="bg-white sticky top-12 z-10">
            <div className="flex items-center">
                <p className="text-xs font-body-website font-semibold min-w-[70px] pl-2">Filtrar por:</p>
                <div className="w-full overflow-x-auto pr-2" >

                    <ul className="py-3 px-2" style={{
                        display: "-webkit-inline-box"
                    }}>
                        <Link to={`/cardapio`} className="text-xs font-body-website font-semibold uppercase text-muted-foreground">
                            <Badge className={
                                cn(
                                    "border border-brand-blue text-brand-blue font-semibold bg-white scale-100 py-1 text-[10px]",
                                    tagFilter === null && "bg-brand-blue text-white scale-110"
                                )
                            }>Todos</Badge>
                        </Link>
                        {tags.map((tag) => (
                            <li key={tag.id} className="ml-2">
                                <Link to={`?tag=${tag.name}`} className="text-xs font-body-website font-semibold uppercase text-muted-foreground">
                                    <BadgeTag tag={tag}
                                        classNameLabel={
                                            cn(
                                                "text-[10px] text-brand-blue",
                                                tagFilter === tag.name && "text-white"
                                            )
                                        } tagColor={false}
                                        classNameContainer={
                                            cn(
                                                "bg-none border border-brand-blue",
                                                tagFilter === tag.name && "bg-brand-blue",
                                                tagFilter === tag.name && " scale-110",
                                                "active:bg-brand-blue active:text-white"

                                            )
                                        } />
                                </Link>
                            </li>
                        ))}


                    </ul>
                </div>
            </div>

            {
                tagFilter && (
                    <div className="absolute top-12 left-0 right-0 flex gap-2 items-center px-2 bg-blue-300 py-[0.15rem]">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex gap-1 items-center">
                                <Filter size={12} />
                                <p className="font-body-website text-[12px]">Você está visualizando os sabores <span className="font-semibold">"{tagFilter}"</span></p>
                            </div>
                            <Link to={`/cardapio`} className="font-body-website text-[12px] underline font-semibold self-end">
                                Voltar
                            </Link>
                        </div>
                    </div>
                )
            }
        </div>


    )
}