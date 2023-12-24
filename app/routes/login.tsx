import { LoaderFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { authenticator } from "~/domain/auth/google.server";

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  return await authenticator.isAuthenticated(request);
}


export default function Login() {
  const loggedUser = useLoaderData<typeof loader>();

  console.log("login pageeee", loggedUser)


  return (
    <div className="grid place-items-center h-screen">
      <div className="flex flex-col gap-4">
        <Form action="/auth/google" method="post" className="mb-8 justify-center flex">
          <Button>Acessar com o Google</Button>
        </Form>

      </div>
    </div>
  )
}