import { LoaderFunction, type LinksFunction, MetaFunction, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { AdminHeader } from "~/components/layout/admin-header/admin-header";
import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import ADMIN_WEBSITE_NAVIGATION_ITEMS from "~/domain/website-navigation/admin/admin-website.nav-links";
import { AdminSidebar } from "~/domain/website-navigation/components/admin-sidebar";
import prismaClient from "~/lib/prisma/client.server";
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

    const slug = lastUrlSegment(request.url)

    return ok({ user, slug, environment, prismaDbName, urlSegment: request.url })
}




export default function AdminOutlet() {
    const loaderData = useLoaderData<typeof loader>();

    const loggedUser = loaderData?.payload?.user;
    const slug = loaderData?.payload?.slug;
    const urlSegment = loaderData?.payload?.urlSegment
    const env = loaderData?.payload?.environment

    return (
        <SidebarProvider data-element="sidebar-provider">
            <AdminSidebar navigationLinks={ADMIN_WEBSITE_NAVIGATION_ITEMS} />
            <SidebarTrigger />
            <div className="flex flex-col w-screen">
                <AdminHeader slug={slug} urlSegment={urlSegment} />
                {/* {env === "development" && <EnvironmentAlert />} */}
                <div className="mt-6 mr-4 md:mr-12" data-element="outer-div-admin-outlet">
                    <Outlet context={{
                        loggedUser,
                    }} />
                </div>
            </div>
        </SidebarProvider>
    )
}


