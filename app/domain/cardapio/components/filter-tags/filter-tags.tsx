import { Tag } from "@prisma/client"
import { Link, useSearchParams } from "@remix-run/react"
import { Filter, FilterIcon } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import BadgeTag from "~/domain/tags/components/badge-tag"
import { cn } from "~/lib/utils"

export default function FiltersTags({ tags, showBanner = false }: { tags: Tag[], showBanner?: boolean }) {

    const [searchParams, setSearchParams] = useSearchParams()
    const tagFilter = searchParams.get("tag")

    return (

        <div className="bg-white sticky top-20 z-10">
            <div className="flex items-center">
                {/* <p className="font-body-website font-semibold min-w-[70px] pl-2">Filtrar por:</p> */}
                <FilterIcon className="w-4 h-4 mx-2" />
                <div className="w-full overflow-x-auto pr-2" >

                    <ul className="pt-4 pb-6 px-2" style={{
                        display: "-webkit-inline-box"
                    }}>
                        <Link to={`/cardapio`} className="font-lg tracking-wider font-body-website font-semibold uppercase text-muted-foreground">
                            <span className={
                                cn(
                                    "text-muted-foreground py-2",
                                    tagFilter === null && "text-black border border-b-black border-b-2 border-t-0 border-r-0 border-l-0"
                                )
                            }>Todos</span>
                        </Link>
                        {tags.map((tag) => (
                            <li key={tag.id} className="ml-3">
                                <Link to={`?tag=${tag.name}`} className="font-lg tracking-wider font-body-website font-semibold uppercase text-muted-foreground">
                                    <BadgeTag tag={tag}
                                        classNameLabel={
                                            cn(
                                                "text-muted-foreground py-2",
                                                tagFilter === tag.name && "text-black border border-b-black border-b-2 border-t-0 border-r-0 border-l-0"
                                            )
                                        } tagColor={false}
                                    />
                                </Link>
                            </li>
                        ))}


                    </ul>
                </div>
            </div>

            {
                showBanner && tagFilter && (
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