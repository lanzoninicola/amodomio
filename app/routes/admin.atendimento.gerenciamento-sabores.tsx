import { Await, defer, useActionData, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { Suspense, useState } from "react";
import { Input } from "~/components/ui/input";
import { mapPriceVariationsLabel } from "~/domain/cardapio/fn.utils";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import Loading from "~/components/loading/loading";
import MenuItemSwitchVisibilitySubmit from "~/domain/cardapio/components/menu-item-switch-visibility/menu-item-switch-visibility-submit";
import { LoaderFunctionArgs } from "@remix-run/node";
import { badRequest, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import tryit from "~/utils/try-it";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { toast } from "~/components/ui/use-toast";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { DialogTitle } from "@radix-ui/react-dialog";
import { Car, ExpandIcon } from "lucide-react";
import OptionTab from "~/components/layout/option-tab/option-tab";
import MenuItemSwitchActivationSubmit from "~/domain/cardapio/components/menu-item-switch-activation.tsx/menu-item-switch-activation-submit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { MenuItemSellingPriceVariation } from "@prisma/client";


export const loader = async () => {

  const cardapioItems = menuItemPrismaEntity.findAll()

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

  if (_action === "menu-item-activation-change") {
    const id = values?.id as string

    const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

    if (errItem) {
      return badRequest(errItem)
    }

    if (!item) {
      return badRequest("Item não encontrado")
    }

    const [err, result] = await tryit(menuItemPrismaEntity.softDelete(id))

    if (err) {
      return badRequest(err)
    }

    const returnedMessage = !item.active === true ? `Sabor "${item.name}" ativado` : `Sabor "${item.name}" desativado`;

    return ok(returnedMessage);
  }

  return null

}


export default function AdminAtendimentoGerenciamentoSabores() {
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
    <Container className="md:max-w-none">



      <Suspense fallback={<Loading />}>
        <Await resolve={cardapioItems}>
          {(cardapioItems) => {

            if (!cardapioItems || cardapioItems.length === 0) {
              return (
                <div className="flex flex-col gap-4 items-center">
                  <h1 className="text-lg font-bold leading-tight tracking-tighter md:text-lg lg:leading-[1.1]">
                    Nenhum sabor cadastrado
                  </h1>
                  <p className="text-sm text-muted-foreground">Cadastre um sabor para começar</p>
                </div>
              )
            }




            const [items] = useState<MenuItemWithAssociations[]>(cardapioItems) // original completo
            const [filteredItems, setFilteredItems] = useState<MenuItemWithAssociations[]>(cardapioItems.filter(i => i.visible === true && i.active === true) || [])


            const [visible, setVisible] = useState(false)
            const [active, setActive] = useState(false)

            const handleOptionVisibileItems = (state: boolean) => {
              setFilteredItems(items.filter(item => item.visible === state && item.active === true))
            }

            const handleOptionActiveItems = (state: boolean) => {
              setFilteredItems(items.filter(item => item.active === state))
            }


            // @ts-ignore
            return (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-8 gap-4 items-center">
                  <h1 className="text-lg font-bold tracking-tighter md:text-lg col-span-2">
                    Gerençiamento sabores
                  </h1>
                  <CardapioItemSearch items={items} setFilteredItems={setFilteredItems} />

                  <Select
                    onValueChange={(value) => {
                      if (value === "active") handleOptionVisibileItems(true)
                      else if (value === "paused") handleOptionVisibileItems(false)
                      else if (value === "inactive") handleOptionActiveItems(false)
                    }}
                    defaultValue={"active"}
                  >
                    <SelectTrigger className="w-[200px] col-span-2">
                      <SelectValue placeholder="Filtrar vendas" />
                    </SelectTrigger>
                    <SelectContent >
                      <SelectItem value="active">Venda ativa</SelectItem>
                      <SelectItem value="paused">Venda pausada</SelectItem>
                      <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col items-center">

                  <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                    {
                      filteredItems.map(item => {
                        return (
                          <CardapioItem
                            key={item.id}
                            item={item}
                            setVisible={setVisible}
                            visible={visible}
                            active={active}
                            setActive={setActive}
                          />

                        )
                      })
                    }

                  </ul>



                </div>
              </div>
            )
          }}
        </Await>
      </Suspense>
    </Container>
  )
}





interface CardapioItemProps {
  item: MenuItemWithAssociations
  visible: boolean,
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
  active: boolean
  setActive: React.Dispatch<React.SetStateAction<boolean>>
  showExpandButton?: boolean
}

function CardapioItem({ item, setVisible, visible, active, setActive, showExpandButton = true }: CardapioItemProps) {


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
          <div className="flex gap-2 items-center">
            {
              showExpandButton === true && (
                <CardapioItemDialog key={item.id} triggerComponent={
                  <ExpandIcon size={16} />
                }>
                  <CardapioItem item={item} setVisible={setVisible} visible={visible} active={active} setActive={setActive} showExpandButton={false} />
                </CardapioItemDialog>
              )
            }

            <CopyButton
              // label="Copiar elenco para imprimir"
              classNameLabel="text-sm md:text-xs "
              classNameButton="border-none text-sm md:text-xs p-1 mr-0 h-max hover:bg-black/20 hover:text-white"
              textToCopy={`*${item.name}*: ${item.ingredients}`}
              variant="outline"
            />
          </div>
        </div>


      </div>

      <ul className="grid grid-cols-3 items-end mb-2">
        {
          item.MenuItemSellingPriceVariation.filter(spv => spv.priceAmount > 0).map((spv) => {
            return (
              <li className="flex flex-col" key={spv.id}>
                <p className="text-xs text-left">{spv.MenuItemSize.nameAbbreviated}: <span className="font-semibold">{spv.priceAmount}</span></p>
              </li>
            )
          })
        }
      </ul>

      <p className="text-xs text-muted-foreground line-clamp-2 text-left">{item.ingredients}</p>
      <Separator className="my-3" />

      <div className="flex justify-end">
        {/* <MenuItemSwitchActivationSubmit menuItem={item} active={active} setActive={setActive} cnLabel="text-[12px]" cnContainer="md:justify-start" /> */}
        <MenuItemSwitchVisibilitySubmit menuItem={item} visible={visible} setVisible={setVisible} cnLabel="text-[12px]" cnContainer="justify-items-end" />
      </div>
    </div>
  )
}

interface CardapioItemDialogProps {
  children?: React.ReactNode;
  triggerComponent?: React.ReactNode;
}

function CardapioItemDialog({ children, triggerComponent }: CardapioItemDialogProps) {

  return (
    <Dialog >
      <DialogTrigger asChild className="w-full">
        <button>
          {triggerComponent}
        </button>
      </DialogTrigger>
      <DialogContent className="p-0 bg-transparent border-none">
        <div className="bg-white p-4">
          <DialogTitle className="text-lg font-bold leading-tight tracking-tighter md:text-lg lg:leading-[1.1] mb-4">
            Detalhes do sabor
          </DialogTitle>
          {children}
          <DialogClose asChild>
            <div className="w-full mt-6">
              <Button type="button" variant="secondary" className="w-full" >
                <span className=" tracking-wide font-semibold uppercase">Fechar</span>
              </Button>
            </div>

          </DialogClose>
        </div>

      </DialogContent>

    </Dialog>
  )
}



function CardapioItemSearch({
  items,
  setFilteredItems,
}: {
  items: MenuItemWithAssociations[],
  setFilteredItems: React.Dispatch<React.SetStateAction<MenuItemWithAssociations[]>>
}) {
  const [search, setSearch] = useState("")

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSearch(value)

    if (!value) {
      return setFilteredItems(items.filter(i => i.visible === true && i.active === true))
    }

    const searchedItems = items
      .filter(item => item.visible === true && item.active === true)
      .filter(item => {
        const tags = item?.tags?.public || []

        return (
          item.name?.toLowerCase().includes(value.toLowerCase()) ||
          item.ingredients?.toLowerCase().includes(value.toLowerCase()) ||
          item.description?.toLowerCase().includes(value.toLowerCase()) ||
          tags.some(t => t?.toLowerCase().includes(value.toLowerCase()))
        )
      })

    setFilteredItems(searchedItems)
  }

  return (
    <div className="flex flex-col gap-4 items-center w-full col-span-4">
      <Input
        name="search"
        className="w-full py-4 text-lg bg-white"
        placeholder="Pesquisar no cardápio..."
        onChange={handleSearch}
        value={search}
      />
    </div>
  )
}
