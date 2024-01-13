import { ActionArgs, redirect } from "@remix-run/node"
import { authenticator } from "~/domain/auth/google.server"

export let loader = () => redirect('/login')

export let action = ({ request }: ActionArgs) => {
    return authenticator.authenticate('google', request, {
        successRedirect: '/admin',
        failureRedirect: "/login?_status=auth-failed"
    })

}