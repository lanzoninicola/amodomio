import { defer, useActionData, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { badRequest, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import tryit from "~/utils/try-it";
import { toast } from "~/components/ui/use-toast";


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


export default function AdminIndex() {
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
            <div className="grid place-items-center h-full">
                <h1 className="text-xl font-bold leading-tight tracking-tighter md:text-lg lg:leading-[1.1]">
                    Bem vindo ao painel de administração! 👋🏻
                </h1>
            </div>



        </Container>
    )
}

