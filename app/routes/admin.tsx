import { LoaderFunction, type LinksFunction, V2_MetaFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { AdminHeader } from "~/components/layout/admin-header/admin-header";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";


export interface AdminOutletContext {
    loggedUser: LoggedUser | null
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
    let user = await authenticator.isAuthenticated(request);

    if (!user) {
        return redirect("/login");
    }
    return user
}




export default function AdminOutlet() {
    const loggedUser = useLoaderData<typeof loader>();

    return (
        <>
            <AdminHeader />
            <div className="mt-12">
                <Outlet context={{
                    loggedUser,

                }} />
            </div>
        </>
    )
}
