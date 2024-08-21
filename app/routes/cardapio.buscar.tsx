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

    return (
        <section className="mt-16 p-4">
            <div className="flex flex-col">
                <Suspense fallback={<Loading />}>

                    <div className="flex flex-col gap-2">
                        <span className="font-semibold font-body-website">Explorar por</span>
                        <Await resolve={tags}>
                            {(tags) => {
                                // @ts-ignore
                                return <SearchFiltersTags tags={tags ?? []} />
                            }}
                        </Await>
                    </div>
                    <Await resolve={items}>

                        {(items) => {
                            // @ts-ignore
                            return <SearchItems items={items ?? []} />
                        }}
                    </Await>

                </Suspense>
            </div>
        </section >


    );

}


function SearchFiltersTags({ tags }: {
    tags: Tag[]
}) {

    return (
        <div className="grid grid-cols-2 gap-4">
            {tags.map(tag => {

                return (
                    <div className="bg-blue-200 p-2 rounded-md flex items-center">
                        <span className="font-body-website text-sm">{capitalize(tag.name)}</span>
                    </div>
                )
            })}
        </div>
    )
}

function SearchItems({ items }: {
    items: MenuItemWithAssociations[],
}) {



    const [currentItems, setCurrentItems] = useState<MenuItemWithAssociations[]>([]);
    const [search, setSearch] = useState("")
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {

        const value = event.target.value.toLowerCase();
        setSearch(value);

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



        setCurrentItems(itemsFounded);
    };



    return (
        <div className="flex flex-col md:w-[450px] my-4">
            <div className=" flex flex-col py-3">

                <div className="max-h-[400px] overflow-y-auto">
                    <span className="text-xs font-body-website mb-4">Resultados:</span>
                    <ul className="flex flex-col gap-2">
                        {currentItems.map((item) => (
                            <FadeIn key={item.id}>
                                <CardapioItemDialog item={item} triggerComponent={

                                    <li className="grid grid-cols-8 py-1" >

                                        <div className="self-start bg-center bg-cover bg-no-repeat w-8 h-8 rounded-lg col-span-1 "
                                            style={{
                                                backgroundImage: `url(${item.MenuItemImage?.thumbnailUrl || "/images/cardapio-web-app/placeholder.png"})`,
                                            }}></div>
                                        <div className="flex flex-col col-span-7">
                                            <span className="font-body-website text-[0.85rem] font-semibold leading-tight uppercase text-left">{item.name}</span>
                                            <span className="font-body-website text-[0.85rem] leading-tight text-left">{item.ingredients}</span>
                                        </div>

                                    </li>
                                } />
                            </FadeIn>

                        ))}
                    </ul>
                </div>
            </div>

            <div className="fixed bottom-4 w-full pr-8  ">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2">
                        {
                            search && <p className="font-body-website text-xs text-muted-foreground mb-2">{currentItems.length} de {items.length} resultados para
                                <span className="font-semibold"> {search}</span>
                            </p>
                        }

                        <div className="bg-brand-blue rounded-md p-2 mb-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle color="white" />
                                <p className="text-xs font-body-website text-white">Dica: você pode buscar por ingrediente, nome da pizza ou por etiqueta (ex. vegetariana, carne)</p>
                            </div>
                        </div>

                        <Input
                            ref={inputRef}
                            placeholder="Digitar 'abobrinha' ou 'vegetarianas'" className="font-body-website text-sm h-8" onChange={handleSearch}

                        />
                    </div>

                    <Link to={GLOBAL_LINKS.cardapioPublic.href}>
                        <Button className="w-full flex gap-2 justify-center" variant={"secondary"}>
                            <span className="text-[12px] tracking-widest font-semibold uppercase" style={{
                                lineHeight: "normal",
                            }}>Voltar</span></Button>
                    </Link>
                </div>
            </div>


        </div>
    )
}