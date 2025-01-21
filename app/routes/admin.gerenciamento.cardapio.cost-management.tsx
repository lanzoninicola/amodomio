import { useOutletContext } from "@remix-run/react"
import { AdminCardapioOutletContext } from "./admin.gerenciamento.cardapio"
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { defer } from "react-router";
import prismaClient from "~/lib/prisma/client.server";


export const loader = async () => {

    const cardapioItems = menuItemPrismaEntity.findAll()
    const sizes = prismaClient.menuItemSize.findMany()

    const data = Promise.all([cardapioItems, sizes]);

    return defer({ data });


}

export default function AdminGerenciamentoCardapioCostManagement() {
    const outletContext: AdminCardapioOutletContext = useOutletContext()

    console.log({ outletContext })

    return <div>helloworl   </div>
}