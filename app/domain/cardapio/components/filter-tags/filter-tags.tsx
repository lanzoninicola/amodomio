import { Tag } from "@prisma/client"
import { Link } from "@remix-run/react"
import { Filter } from "lucide-react"
import { useSoundEffects } from "~/components/sound-effects/use-sound-effects"
import BadgeTag from "~/domain/tags/components/badge-tag"
import { cn } from "~/lib/utils"

interface FiltersTagsProps {
    tags: Tag[]
    currentTag: Tag
    onCurrentTagSelected: (tag: Tag) => void
    showBanner?: boolean
}

export default function FiltersTags({
    tags,
    currentTag,
    onCurrentTagSelected,
    showBanner = false
}: FiltersTagsProps) {
    const { playFilter } = useSoundEffects()
    const tagsWithTodos = [
        {
            id: "all",
            name: "Todos",
            colorHEX: "#eab308",
            featuredFilter: false,
            sortOrderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            public: true
        },
        ...tags
    ]

    const sortedTags = tagsWithTodos.sort((a, b) =>
        Number(b.featuredFilter) - Number(a.featuredFilter)
    )

    return (
        <div className="bg-white sticky top-20 z-10">
            <div className="flex flex-col">
                <p className="font-neue text-sm font-semibold pl-2">Filtrar por:</p>

                <div className="w-full overflow-x-auto pr-2">
                    <ul className="flex gap-4 overflow-x-auto whitespace-nowrap px-2" >
                        {sortedTags.map(tag => {
                            const isActive = currentTag?.id === tag.id

                            return (
                                <li key={tag.id} className="my-2">
                                    <button
                                        title={tag.name} // Tooltip nativo do navegador
                                        onClick={() => {
                                            playFilter()
                                            onCurrentTagSelected(tag as Tag)
                                        }}
                                    >
                                        <BadgeTag
                                            tag={tag}
                                            classNameContainer={cn(
                                                "border border-black rounded-xl my-2",
                                                "transition-all duration-300 ease-in-out",
                                                isActive && "outline outline-yellow-500 border-none",
                                            )}
                                            classNameLabel={cn(
                                                "font-neue text-xs uppercase whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ease-in-out",
                                            )}
                                            allowRemove={false}
                                            tagColor={false}
                                        />
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </div>

            {showBanner && currentTag && (
                <div className="absolute top-12 left-0 right-0 flex items-center justify-between px-2 py-1 bg-blue-300 text-[12px] font-neue animate-fade-in">
                    <div className="flex items-center gap-1">
                        <Filter size={12} />
                        <p>
                            Você está visualizando os sabores <span className="font-semibold">"{currentTag.name}"</span>
                        </p>
                    </div>
                    <Link to="/cardapio" className="underline font-semibold">
                        Voltar
                    </Link>
                </div>
            )}
        </div>
    )
}
