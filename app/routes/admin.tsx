import { LoaderFunction, type LinksFunction, MetaFunction, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { X } from "lucide-react";
import { useState } from "react";
import { AdminHeader } from "~/components/layout/admin-header/admin-header";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";


export interface AdminOutletContext {
    loggedUser: LoggedUser | null
    operatorId: string
    setOperatorId: (operatorId: string) => void
}

export const meta: MetaFunction = () => [
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

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
    const environment = process.env.NODE_ENV
    const prismaDbName = prismaClient.dbName

    let user = await authenticator.isAuthenticated(request);

    if (!user) {
        return redirect("/login");
    }

    const urlSegment = lastUrlSegment(request.url)

    return ok({ user, urlSegment, environment, prismaDbName })
}




export default function AdminOutlet() {
    const loaderData = useLoaderData<typeof loader>();

    const loggedUser = loaderData?.payload?.user;
    const urlSegment = loaderData?.payload?.urlSegment;
    const env = loaderData?.payload?.environment

    return (
        <>
            <AdminHeader urlSegment={urlSegment} />
            {/* {env === "development" && <EnvironmentAlert />} */}
            <div className="mt-12">
                <Outlet context={{
                    loggedUser,
                }} />
            </div>
        </>
    )
}


function EnvironmentAlert() {
    const loaderData = useLoaderData<typeof loader>();
    const dbName = loaderData?.payload?.prismaDbName;

    const [show, setShow] = useState(true)

    return (
        <div className={
            cn(
                "fixed top-4 left-1/2 transform -translate-x-1/2 opacity-70 bg-red-600 px-4 py-2 rounded-lg z-50 hover:opacity-100 transition-opacity",
                show === false && "hidden"
            )
        }>
            <div className="relative flex flex-col gap-2 mb-2">
                <p className="text-white text-center leading-tight">Ambiente de desenvolvimento</p>
                <span className="text-xs text-white">Database: {dbName}</span>
            </div>
            <span className="text-xs text-white underline cursor-pointer" onClick={() => setShow(false)}>Fechar</span>

        </div>

    )
}