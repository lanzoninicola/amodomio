import { LoaderArgs, json } from "@remix-run/node";
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { settingEntity } from "~/domain/setting/setting.entity.server";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import getSearchParam from "~/utils/get-search-param";
import { badRequest, ok, serverError } from "~/utils/http-response.server";


// handle GET request
export async function loader({ request, params }: LoaderArgs) {

    const context = getSearchParam({ request, paramName: "context" })

    if (context === "cardapio-pizza-taglio") {
        const [err, options] = await prismaIt(settingPrismaEntity.findAllByContext("cardapio-pizza-taglio"))

        if (err) {
            return serverError(err)
        }

        console.log({ options })

        return ok({ options })

    }

    return ok({}, {
        allowOrigin: "*",
        allowMethods: "GET, POST, OPTIONS",
        referrerPolicy: "no-referrer",
    })
}


// handle POST request
export async function action({ request }: ActionArgs) {

    // console.log(request)

    // const body = await request.json();
    // const action = body?.action
    // const secretKey = body?.secret


    // if (!secretKey || secretKey !== process.env.REST_API_SECRET_KEY) {
    //     return ok()
    // }

    // if (action === "cardapio-pizza-taglio-upsert") {

    //     const [err, record] = await prismaIt(settingPrismaEntity.updateOrCreate({
    //         context: "cardapio-pizza-taglio",
    //         value: body?.value,
    //         type: "string",
    //         name: "browser-extension-content",
    //         createdAt: new Date().toISOString(),
    //     }))

    //     if (err) {
    //         return serverError('Erro ao salvar configuração')
    //     }

    //     return ok(record, {
    //         allowOrigin: "*",
    //         allowMethods: "GET, POST, OPTIONS",
    //     })

    // }



    return ok({}, {
        allowOrigin: "*",
        allowMethods: "GET, POST, OPTIONS",
        referrerPolicy: "no-referrer",
    })
};
