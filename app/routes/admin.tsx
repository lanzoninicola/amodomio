import { LoaderFunction, type LinksFunction, V2_MetaFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { AdminHeader } from "~/components/layout/admin-header/admin-header";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { ok } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";


export interface AdminOutletContext {
    loggedUser: LoggedUser | null
    cardapioItems: MenuItemWithAssociations[]
    operatorId: string
    setOperatorId: (operatorId: string) => void
}

export const meta: V2_MetaFunction = () => [
    { name: "robots", content: "noindex" },
];


export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://api.fonts.coollabs.io" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
    },
    {
        href: "https://api.fonts.coollabs.io/css2?family=Inter:wght@400;600;800&display=swap",
        rel: "stylesheet",
    },
];

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
    const environment = process.env.NODE_ENV
    const prismaDbName = prismaClient.dbName

    let user = await authenticator.isAuthenticated(request);

    const [_, cardapioItems] = await prismaIt(menuItemPrismaEntity.findAll({
        where: {
            visible: true
        }
    }))

    if (!user) {
        return redirect("/login");
    }

    const urlSegment = lastUrlSegment(request.url)

    return ok({ user, urlSegment, environment, prismaDbName, cardapioItems })
}




export default function AdminOutlet() {
    const loaderData = useLoaderData<typeof loader>();

    const loggedUser = loaderData?.payload?.user;
    const urlSegment = loaderData?.payload?.urlSegment;
    const cardapioItems = loaderData?.payload?.cardapioItems
    const env = loaderData?.payload?.environment

    return (
        <>
            <AdminHeader urlSegment={urlSegment} />
            {env === "development" && <EnvironmentAlert />}
            <div className="mt-12">
                <Outlet context={{
                    loggedUser,
                    cardapioItems,

                }} />
            </div>
        </>
    )
}


function EnvironmentAlert() {
    const loaderData = useLoaderData<typeof loader>();

    const dbName = loaderData?.payload?.prismaDbName;

    return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 opacity-70 bg-red-600 p-4 rounded-lg z-50 hover:opacity-100 transition-opacity">
            <div className="flex flex-col gap-2">
                <p className="text-white text-center leading-tight">Ambiente de desenvolvimento</p>
                <span className="text-xs text-white">Database: {dbName}</span>
            </div>
        </div>

    )
}