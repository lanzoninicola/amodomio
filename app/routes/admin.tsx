import { LoaderFunction, type LinksFunction, MetaFunction, V2_MetaFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { NavMenuCollapsible } from "~/components/primitives/menu-collapsible/nav-menu-collapsible";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";


export interface AdminOutletContext {
    loggedUser: LoggedUser | null
}

export const meta: V2_MetaFunction = () => [
    { name: "robots", content: "noindex" },
];


export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
    },
    {
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap",
        rel: "stylesheet",
    },
];

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {

    let user = await authenticator.isAuthenticated(request);
    console.log("admin loader", user)

    if (!user) {
        return redirect("/login");
    }
    return user
}


export default function AdminOutlet() {
    const loggedUser = useLoaderData<typeof loader>();



    return (

        <div className="flex flex-col">
            <div className="fixed h-auto w-full bg-muted z-50">
                <NavMenuCollapsible navItems={
                    [
                        { label: "Gerençiar cardápio", to: "/admin" },
                        { label: "Cardápio", to: "/cardapio" },
                        { label: "Categorias", to: "/admin/categorias" },
                        { label: "Opções", to: "/admin/options" },
                        { label: "Massa", to: "/admin/dough" },
                        { label: "Pedidos", to: "/admin/daily-orders" },
                    ]
                } />
            </div>
            <Outlet context={{
                loggedUser
            }} />
        </div>
    )
}

