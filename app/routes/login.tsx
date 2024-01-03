import { LoaderFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { AlertError } from "~/components/layout/alerts/alerts";
import { Button } from "~/components/ui/button";
import { authenticator } from "~/domain/auth/google.server";
import getSearchParam from "~/utils/get-search-param";
import { unauthorized } from "~/utils/http-response.server";

export let loader = ({ request }: LoaderArgs) => {

  const authParam = getSearchParam({ request, paramName: 'auth' })

  if (authParam === 'failed') {
    return unauthorized('Falha ao autenticar com o Google')
  }

  return null
}

export default function Login() {
  const loaderData = useLoaderData<typeof loader>()

  const status = loaderData?.status
  const message = loaderData?.message

  return (
    <div className="grid place-items-center h-screen">
      <div className="flex flex-col gap-4">
        <Form action="/auth/google" method="post" className="mb-8 justify-center flex">
          <Button>Acessar com o Google</Button>
        </Form>
        {
          status == 401 && (
            <AlertError message={message || "Falha na autenticação"} />
          )
        }

      </div>
    </div>
  )
}