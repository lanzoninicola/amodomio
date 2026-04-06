import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "~/components/primitives/logo/logo";
import { issueTemporaryPassword } from "~/domain/auth/admin-user-access.server";

type ActionData = {
  success?: string;
};

const GENERIC_SUCCESS_MESSAGE =
  "Se houver um cadastro apto para recuperacao, uma nova senha temporaria sera enviada. Ela expira em 30 minutos.";

export const meta: MetaFunction = () => [{ title: "Recuperar password" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const sent = String(url.searchParams.get("sent") || "").trim() === "1";

  return json({
    success: sent ? GENERIC_SUCCESS_MESSAGE : null,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");

  try {
    await issueTemporaryPassword({ username, request });
  } catch (error) {
    console.error("[reset-password.action]", error);
  }

  return json<ActionData>({
    success: GENERIC_SUCCESS_MESSAGE,
  });
}

export default function ResetPasswordRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const success = actionData?.success || loaderData.success;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-white text-black lg:flex lg:items-center lg:justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,0,0,0.06),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(0,0,0,0.08),_transparent_40%)]" />
          <div className="relative flex items-center justify-center p-12 w-full h-full">
            <Logo color="black" className="w-72" onlyText />
          </div>
        </section>

        <section className="flex items-center justify-center bg-black px-6 py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2 lg:hidden">
              <Logo color="white" className="w-48" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Recuperar password</h2>
              <p className="text-sm text-zinc-400">
                Informe seu username para solicitar uma nova senha temporaria.
              </p>
            </div>

            {success ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {success}
              </div>
            ) : null}

            <Form method="post" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-zinc-200">Username</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  placeholder="ex.: gustavo.b"
                  className="bg-white text-black"
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Solicitar nova password
              </Button>
            </Form>

            <div className="text-sm text-zinc-400">
              <Link to="/login" className="underline-offset-4 hover:text-white hover:underline">
                Voltar para login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
