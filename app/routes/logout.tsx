import { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";


export const loader = async ({ request }: LoaderFunctionArgs) => {
    return await authenticator.logout(request, { redirectTo: "/login" });
}

