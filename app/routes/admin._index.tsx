import { Await, defer, useActionData, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { Suspense, useState } from "react";
import { Input } from "~/components/ui/input";
import { mapPriceVariationsLabel } from "~/domain/cardapio/fn.utils";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import Loading from "~/components/loading/loading";
import MenuItemSwitchVisibility from "~/domain/cardapio/components/menu-item-switch-visibility/menu-item-switch-visibility";
import { LoaderFunctionArgs } from "@remix-run/node";
import { badRequest, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import tryit from "~/utils/try-it";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { toast } from "~/components/ui/use-toast";

export const loader = async () => {

    const cardapioItems = menuItemPrismaEntity.findAll({
        where: {
            active: true
        }
    })

    return defer({
        cardapioItems,
    })
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-visibility-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            visible: !item.visible
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.visible === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

        return ok(returnedMessage);
    }

    return null

}


export default function AdminIndex() {
    const { cardapioItems } = useLoaderData<typeof loader>()


    const actionData = useActionData<typeof action>();

    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
        });
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "Ok",
            description: actionData.message,
        });
    }

    return (
        <Container>
            <div className="flex flex-col gap-4 items-center mb-6">
                <h1 className="text-center text-xl font-bold leading-tight tracking-tighter md:text-lg lg:leading-[1.1]">
                    Bem vindo ao painel de administração! 👋🏻
                </h1>
            </div>


            <Suspense fallback={<Loading />}>
                <Await resolve={cardapioItems}>
                    {(cardapioItems) => {
                        // @ts-ignore
                        return <CardapioItems cardapioItems={cardapioItems} />
                    }}
                </Await>
            </Suspense>
        </Container>
    )
}


function CardapioItems({
    cardapioItems }: {
        cardapioItems: MenuItemWithAssociations[]
    }
) {
    // const outletContext = useOutletContext<AdminOutletContext>()
    // const initialItems = outletContext?.cardapioItems
    const [items, setItems] = useState<MenuItemWithAssociations[]>(cardapioItems || [])

    const [search, setSearch] = useState("")

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {

        const value = event.target.value

        setSearch(value)

        if (!value) return setItems(cardapioItems)

        const searchedItems = cardapioItems
            .filter(item => {

                const tags = item?.tags?.public || []

                return (
                    item.name?.toLowerCase().includes(value.toLowerCase())
                    || item.ingredients?.toLowerCase().includes(value.toLowerCase())
                    || item.description?.toLowerCase().includes(value.toLowerCase())
                    || (tags.filter(t => t?.toLowerCase().includes(value.toLowerCase())).length > 0)
                )
            })


        setItems(searchedItems)

    }

    const [visible, setVisible] = useState(false)

    const [showActiveItems, setShowActiveItems] = useState(true)

    return (
        <div className="flex flex-col items-center">

            <div className="flex flex-col gap-4 items-center md:w-[500px] mb-6">
                <Input name="search" className="w-full py-4 text-lg" placeholder="Pesquisar no cardapio..." onChange={(e) => handleSearch(e)} value={search} />
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center w-full">
                    <div className="flex gap-4">
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Novidade</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Vegetarianas</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Carne</span>
                        <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Doce</span>
                    </div>
                    <span className="text-xs text-muted-foreground ">Resultados: {items.length}</span>
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <span className={
                    cn(
                        "text-xs uppercase tracking-widest cursor-pointer hover:underline text-muted-foreground",
                        showActiveItems === true && "text-black font-semibold"
                    )
                }
                    onClick={() => setShowActiveItems(true)}>Venda ativa</span>

                <span>-</span>
                <span className={
                    cn(
                        "text-xs uppercase tracking-widest cursor-pointer hover:underline text-muted-foreground",
                        showActiveItems === false && "text-black font-semibold"
                    )
                }
                    onClick={() => setShowActiveItems(false)}>Venda pausada</span>
            </div>
            <Separator className="my-2 w-full" />

            <div className="h-[350px] overflow-y-auto p-2 md:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                    {
                        items.filter(i => {
                            return showActiveItems === true ? i.visible === true : i.visible === false
                        }).map(item => {
                            return (
                                <div className={
                                    cn(
                                        "border rounded-lg p-4",
                                        item?.visible === false && "border-red-500/50 bg-red-500/10",
                                    )
                                } key={item.id}>
                                    <div className="flex flex-col  mb-2">

                                        <div className="flex justify-between items-center">
                                            <h2 className="text-xs uppercase font-semibold tracking-wide">{item.name}</h2>
                                            <CopyButton
                                                // label="Copiar elenco para imprimir"
                                                classNameLabel="text-sm md:text-xs "
                                                classNameButton="border-none text-sm md:text-xs p-1 mr-0 h-max hover:bg-black/20 hover:text-white"
                                                textToCopy={`*${item.name}*: ${item.ingredients}`}
                                                variant="outline"
                                            />
                                        </div>


                                    </div>

                                    <ul className="grid grid-cols-2 items-end mb-2">
                                        {
                                            item.priceVariations.map(pv => {
                                                if (pv.amount <= 0) return

                                                return (
                                                    <li className="flex flex-col" key={pv.id}>
                                                        <p className="text-xs">{mapPriceVariationsLabel(pv.label)}: <span className="font-semibold">{pv.amount.toFixed(2)}</span></p>
                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
                                    <p className="text-xs text-muted-foreground line-clamp-2 ">{item.ingredients}</p>
                                    <Separator className="my-3" />

                                    <MenuItemSwitchVisibility menuItem={item} visible={visible} setVisible={setVisible} cnLabel="text-[12px]" />
                                </div>
                            )
                        })
                    }

                </div>
            </div>


        </div>
    )
}
