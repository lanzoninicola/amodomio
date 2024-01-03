import { LoaderArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";


export const loader = async ({ request }: LoaderArgs) => {
    return await authenticator.logout(request, { redirectTo: "/login" });
}

