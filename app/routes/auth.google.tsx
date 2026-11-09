import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { authenticator } from "~/domain/auth/google.server"

function authenticate(request: Request) {
    return authenticator.authenticate('google', request, {
        successRedirect: '/admin',
        failureRedirect: "/login?_status=auth-failed"
    })
}

export let loader = ({ request }: LoaderFunctionArgs) => {
    return authenticate(request)
}

export let action = ({ request }: ActionFunctionArgs) => authenticate(request)
