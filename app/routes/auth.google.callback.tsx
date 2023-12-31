import { LoaderArgs, redirect } from "@remix-run/node"
import { authenticator } from "~/domain/auth/google.server"

export let loader = ({ request }: LoaderArgs) => {
    return authenticator.authenticate('google', request, {
        successRedirect: '/admin',
        failureRedirect: '/login?auth=failed',
    })
}