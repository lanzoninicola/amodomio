
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Await, defer, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import CardapioItemPrice from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ request, params }: LoaderFunctionArgs) {

  const { id } = params;

  if (!id) {
    return redirect("/cardapio");
  }

  // Aqui você pode buscar o item do cardápio pelo ID
  const itemQuery = prismaIt(menuItemPrismaEntity.findById(id));




  return defer({
    itemQuery,
  });

}

export default function SingleCardapioItem() {
  const { itemQuery } = useLoaderData<typeof loader>()

  return (

    <Suspense fallback={
      <div
        className="min-h-screen flex items-center justify-center ">
        <Loading />
      </div>

    }>
      <Await resolve={itemQuery}>
        {([err, item]) => {

          if (err) {
            console.error(err)
            return <div>Erro ao carregar o item do cardápio</div>
          }


          console.log({ item })

          const itemImageUrl = item?.imageTransformedURL
          const itemName = item?.name
          const itemIngredients = item?.ingredients

          // @ts-ignore
          return (
            <div
              className="relative w-full h-screen bg-cover bg-center"
              style={{
                backgroundImage: itemImageUrl ? `url(${itemImageUrl})` : "none",
              }}
            >
              {/* Overlay de gradiente preto */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

              {/* Conteúdo de texto fixo no fundo */}
              <div className="absolute bottom-0 w-full px-6 pb-8 text-white z-10">

                <h1 className="font-body-website text-2xl uppercase font-semibold tracking-wider">{itemName}</h1>
                <p className="leading-snug text-[15px] my-2">{itemIngredients}</p>
                <Separator className="my-2 bg-white/20" />
                <CardapioItemPrice prices={item?.priceVariations} cnLabel="text-white" cnValue="text-white" showValuta={false} />
              </div>

            </div>
          )
        }}
      </Await>
    </Suspense>


  );
}