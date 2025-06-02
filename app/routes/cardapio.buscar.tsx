import { MenuItemTag, Tag } from "@prisma/client";
import { Separator } from "@radix-ui/react-separator";
import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, Link, useLoaderData } from "@remix-run/react";
import { AlertTriangle, XIcon } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import Loading from "~/components/loading/loading";
import FadeIn from "~/components/primitives/fade-in/fade-in";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import CardapioItemDialog from "~/domain/cardapio/components/cardapio-item-dialog/cardapio-item-dialog";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import BadgeTag from "~/domain/tags/components/badge-tag";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import capitalize from "~/utils/capitalize";

export async function loader({ request }: LoaderFunctionArgs) {
    //@ts-ignore
    const items = menuItemPrismaEntity.findAll({
        where: {
            visible: true,
        },
        option: {
            sorted: true,
            direction: "asc"
        },
        // mock: env === "development"
    }, {
        imageTransform: true,
        imageScaleWidth: 375
    })




    const tags = tagPrismaEntity.findAll({
        public: true
    })

    return defer({
        items,
        tags
    })


}

export default function CardapioSearch() {
    const { items, tags } = useLoaderData<typeof loader>()
    const [searchedTerm, setSearchedTerm] = useState("")
    const [currentItems, setCurrentItems] = useState<MenuItemWithAssociations[]>([]);

    return (
        <section className="mt-20 p-4">

            <div className="flex flex-col gap-4 mb-6">
                <Suspense fallback={<Loading />}>
                    <Await resolve={items}>
                        {(items) => {
                            // @ts-ignore
                            return <SearchItemsInput items={items}
                                currentItems={currentItems}
                                setCurrentItems={setCurrentItems}
                                searchedTerm={searchedTerm}
                                setSearchedTerm={setSearchedTerm}
                            />
                        }}
                    </Await>
                </Suspense>
                <Suspense fallback={<Loading />}>

                    <div className="flex flex-col gap-2">
                        <span className="font-semibold font-neue text-md md:text-lg">Explorar por</span>
                        <Await resolve={tags}>
                            {(tags) => {
                                // @ts-ignore
                                return <SearchFiltersTags tags={tags ?? []} setSearchedTerm={setSearchedTerm} />
                            }}
                        </Await>
                    </div>
                </Suspense>
                {/* <Suspense fallback={<Loading />}>
                    <Await resolve={items}>

                        {(items) => {
                            // @ts-ignore
                            return <FoundedItems items={items ?? []} />
                        }}
                    </Await>

                </Suspense> */}
                <FoundedItems items={currentItems} />
            </div>
            <Link to={GLOBAL_LINKS.cardapioPublic.href}>
                <Button className="w-full flex gap-2 justify-center" variant={"secondary"}>
                    <span className="text-[12px] tracking-widest font-semibold uppercase" style={{
                        lineHeight: "normal",
                    }}>Voltar</span></Button>
            </Link>
        </section >


    );

}


function SearchFiltersTags({ tags, setSearchedTerm }: {
    tags: Tag[],
    setSearchedTerm: React.Dispatch<React.SetStateAction<string>>
}) {

    return (
        <div className="grid grid-cols-2 gap-4">
            {tags.map(tag => {

                return (
                    <div key={tag.id} className="bg-black p-2 rounded-md flex items-center cursor-pointer" onClick={() => setSearchedTerm(tag.name)}>
                        <span className="font-neue text-md lg:text-lg text-white uppercase tracking-wide font-semibold">{capitalize(tag.name)}</span>
                    </div>
                )
            })}
        </div>
    )
}

function SearchItemsInput({ items, currentItems, setCurrentItems, searchedTerm, setSearchedTerm }: {
    items: MenuItemWithAssociations[],
    currentItems: MenuItemWithAssociations[],
    setCurrentItems: React.Dispatch<React.SetStateAction<MenuItemWithAssociations[]>>
    searchedTerm: string
    setSearchedTerm: React.Dispatch<React.SetStateAction<string>>,

}) {


    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value.toLowerCase();

        search(value);
    };

    const search = (value: string) => {
        if (!value) {
            setCurrentItems([]);
            return;
        }
        const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const itemsFounded = items.filter(item =>
            normalizeString(item.name).includes(normalizeString(value)) ||
            normalizeString(item.ingredients).includes(normalizeString(value)) ||
            normalizeString(item.description).includes(normalizeString(value)) ||
            (item.tags?.public && item.tags?.public.filter(tag => normalizeString(tag).includes(normalizeString(value))).length > 0)
        );

        setSearchedTerm(value);
        setCurrentItems(itemsFounded);
    }

    useEffect(() => {
        search(searchedTerm);
    }, [searchedTerm])

    return (
        <div className="flex flex-col gap-2 md:mt-12">
            <Input
                ref={inputRef}
                placeholder="Digitar 'abobrinha' ou 'vegetarianas'" className="font-neue text-sm h-8" onChange={handleSearch}
                defaultValue={searchedTerm}

            />
            {
                searchedTerm && <p className="font-neue text-xs text-muted-foreground mb-2">{currentItems.length} de {items.length} resultados para
                    <span className="font-semibold"> {searchedTerm}</span>
                </p>
            }
            <div className="bg-slate-200 rounded-md p-2 mb-2">
                <div className="flex items-center gap-2">
                    <AlertTriangle />
                    <p className="text-xs font-neue">Dica: você pode buscar por ingrediente, nome da pizza ou por etiqueta (ex. vegetariana, carne)</p>
                </div>
            </div>
        </div>


    )

}

function FoundedItems({ items }: {
    items: MenuItemWithAssociations[],
}) {

    return (
        <div className="max-h-[400px] overflow-y-auto">

            <div className="max-h-[400px] overflow-y-auto">
                <span className="text-xs font-neue mb-4">Resultados:</span>
                <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                        <FadeIn key={item.id}>
                            <CardapioItemDialog item={item} triggerComponent={

                                <li className="grid grid-cols-8 py-1" >

                                    <div className="self-start bg-center bg-cover bg-no-repeat w-8 h-8 rounded-lg col-span-1 "
                                        style={{
                                            backgroundImage: `url(${item.MenuItemImage?.thumbnailUrl || "/images/cardapio-web-app/placeholder.png"})`,
                                        }}></div>
                                    <div className="flex flex-col col-span-7">
                                        <span className="font-neue text-[0.85rem] font-semibold leading-tight uppercase text-left">{item.name}</span>
                                        <span className="font-neue text-[0.85rem] leading-tight text-left">{item.ingredients}</span>
                                    </div>

                                </li>
                            } />
                        </FadeIn>

                    ))}
                </ul>
            </div>
        </div>

    )
}