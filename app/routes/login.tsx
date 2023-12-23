import { LoaderFunction, LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { LogIn } from "lucide-react";
import { Button } from "~/components/ui/button";
import { authenticator } from "~/domain/auth/google.server";

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  let user = await authenticator.isAuthenticated(request);

  console.log("loader login", user)


  // here we can get the "routerCaller" param to identify where to redirect after login succesfull
  if (user) {
    return redirect("/admin");
  }


  return {
    loggedUser: user
  }

}


export default function Login() {
  const loggedUser = useLoaderData<typeof loader>();

  console.log("login", loggedUser)


  return (
    <div className="grid place-items-center h-screen">
      <div className="flex flex-col gap-4">
        <Form action="/auth/google" method="post" className="mb-8 justify-center flex">
          <Button>Acessar com o Google</Button>
        </Form>
        {
          !loggedUser && (
            <div>
              <span>user not identify</span>
            </div>
          )
        }
      </div>
    </div>
  )
}