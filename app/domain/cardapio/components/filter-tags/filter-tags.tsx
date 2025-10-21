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

export function FiltersTags({
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

// ---- IMPORTS ADICIONAIS ----
import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover"
import { Command, CommandInput, CommandGroup, CommandItem, CommandEmpty } from "~/components/ui/command"
import capitalize from "~/utils/capitalize"

// ---- NOVO COMPONENTE ----
interface FilterTagSelectProps {
    tags: Tag[]
    currentTag?: Tag | null
    onCurrentTagSelected: (tag: Tag) => void
    className?: string
    label?: string // texto quando nenhuma tag está selecionada
}

export function FilterTagSelect({
    tags,
    currentTag,
    onCurrentTagSelected,
    className,
    label = "Categorias",
}: FilterTagSelectProps) {
    const { playFilter } = useSoundEffects()
    const [open, setOpen] = React.useState(false)

    // injeta "Todos" e ordena (destaques primeiro)
    const tagsWithTodos: Tag[] = React.useMemo(
        () =>
            ([
                {
                    id: "all",
                    name: "Todos",
                    colorHEX: "#eab308",
                    featuredFilter: false,
                    sortOrderIndex: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                    public: true,
                },
                ...tags,
            ] as unknown) as Tag[],
        [tags]
    )

    const sortedTags = React.useMemo(
        () => tagsWithTodos.sort((a, b) => Number(b.featuredFilter) - Number(a.featuredFilter)),
        [tagsWithTodos]
    )

    function handleSelect(tag: Tag) {
        playFilter()
        onCurrentTagSelected(tag)
        setOpen(false)
    }

    const activeLabel = currentTag?.name ?? label

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "h-9 rounded-md bg-slate-200 px-3 text-sm font-medium",
                        "inline-flex items-center gap-2",
                        className
                    )}
                >
                    <span className="truncate max-w-[140px] font-neue tracking-wide">{activeLabel}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[260px] p-0" align="start">
                <Command shouldFilter={true}>
                    {/* <CommandInput placeholder="Buscar categoria..." className="font-neue" /> */}
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup className="max-h-[280px] overflow-auto">
                        {sortedTags.map((tag) => (
                            <CommandItem
                                key={tag.id}
                                value={String(tag.name)}
                                onSelect={() => handleSelect(tag as Tag)}
                                className="flex cursor-pointer items-center gap-2"
                            >
                                {currentTag?.id === tag.id &&
                                    (
                                        <Check
                                            className={cn(
                                                "h-4 w-4",
                                                currentTag?.id === tag.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                    )
                                }
                                <span className="truncate font-neue tracking-wide uppercase text-xs">{capitalize(tag.name)}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
