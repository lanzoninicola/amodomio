import { Tag } from "@prisma/client"
import { Link, useSearchParams } from "@remix-run/react"
import { Filter, FilterIcon } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import BadgeTag from "~/domain/tags/components/badge-tag"
import { cn } from "~/lib/utils"

export default function FiltersTags({ tags, showBanner = false }: { tags: Tag[], showBanner?: boolean }) {

    const [searchParams, setSearchParams] = useSearchParams()
    const tagFilter = searchParams.get("tag")

    const tagsWithTodos = [
        {
            id: "all",
            name: "Todos",
            colorHEX: "#000000",
            createdAt: new Date(),
            deletedAt: null,
            updatedAt: new Date(),
            public: true
        },
        ...tags
    ]

    const linkUrl = (tag: Tag) => {
        if (tag.id === "all") {
            return "/cardapio"
        }
        return `/cardapio?tag=${tag.name}`
    }

    return (

        <div className="bg-white sticky top-20 z-10">
            <div className="flex flex-col ">
                <p className="font-neue text-sm font-semibold min-w-[70px] pl-2">Filtrar por:</p>
                {/* <FilterIcon className="w-4 h-4 mx-2" /> */}
                <div className="w-full overflow-x-auto pr-2" >

                    <ul className="py-1 pr-2" style={{
                        display: "-webkit-inline-box"
                    }}>

                        {tagsWithTodos.map((tag) => (
                            <li key={tag.id} className="ml-3">
                                <Link to={linkUrl(tag)}
                                    className="text-[13px] font-medium tracking-widest font-neue uppercase text-muted-foreground">
                                    <BadgeTag tag={tag}
                                        classNameLabel={
                                            cn(
                                                "text-muted-foreground py-2",
                                                tagFilter === tag.name && "text-black border border-b-black border-b-2 border-t-0 border-r-0 border-l-0"
                                            )
                                        }
                                        allowRemove={false}
                                        tagColor={false}
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
                                <p className="font-neue text-[12px]">Você está visualizando os sabores <span className="font-semibold">"{tagFilter}"</span></p>
                            </div>
                            <Link to={`/cardapio`} className="font-neue text-[12px] underline font-semibold self-end">
                                Voltar
                            </Link>
                        </div>
                    </div>
                )
            }
        </div>


    )
}