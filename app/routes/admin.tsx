import { LoaderFunction, type LinksFunction, MetaFunction, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AdminHeader } from "~/components/layout/admin-header/admin-header";
import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import ADMIN_NAVIGATION_LINKS from "~/domain/website-navigation/links/admin-navigation";
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

    const pinnedNav = await prismaClient.adminNavigationClick.findMany({
        where: { pinned: true },
        select: { href: true },
        orderBy: [{ lastClickedAt: "desc" }],
        take: 50,
    });

    return ok({
        user,
        slug,
        environment,
        prismaDbName,
        urlSegment: request.url,
        pinnedNavHrefs: pinnedNav.map((item) => item.href),
    })
}




export default function AdminOutlet() {
    const loaderData = useLoaderData<typeof loader>();

    const loggedUser = loaderData?.payload?.user;
    const slug = loaderData?.payload?.slug;
    const urlSegment = loaderData?.payload?.urlSegment
    const env = loaderData?.payload?.environment
    const pinnedNavHrefs = loaderData?.payload?.pinnedNavHrefs ?? [];

    return (
        <SidebarProvider data-element="sidebar-provider">
            <AdminSidebar navigationLinks={ADMIN_NAVIGATION_LINKS} pinnedHrefs={pinnedNavHrefs} />
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

export function ErrorBoundary() {
    const error = useRouteError();

    console.error("[admin] route error boundary", error);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10">
            <div className="mx-auto max-w-2xl rounded-xl border bg-white p-6 md:p-8 shadow-sm space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin</p>
                <h1 className="text-2xl md:text-3xl font-semibold">Ocorreu um erro no painel administrativo</h1>
                <p className="text-sm md:text-base text-slate-600">
                    Atualize a página ou volte para o painel. Se o problema continuar, acione o suporte interno.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Link
                        to="/admin"
                        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Voltar ao painel
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        Ir para o site
                    </Link>
                </div>
            </div>
        </div>
    );
}
