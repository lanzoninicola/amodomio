import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import Logo from "~/components/primitives/logo/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authenticator } from "~/domain/auth/google.server";

type ActionData = {
  error?: string;
  success?: string;
};

export let loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const status = String(url.searchParams.get("_status") || "").trim();

  let error: string | null = null;
  if (status === "access-denied") {
    error = "Seu acesso nao esta liberado para esta modalidade de login.";
  } else if (status === "auth-failed") {
    error = "Falha ao autenticar com o Google.";
  } else if (status === "password-failed") {
    error = "Username ou password invalidos.";
  } else if (status === "session-expired") {
    error = "Sua sessao expirou. Entre novamente.";
  }

  return json({ error });
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("_intent") || "").trim();

  if (intent === "password-login") {
    return authenticator.authenticate("password", request, {
      successRedirect: "/admin",
      failureRedirect: "/login?_status=password-failed",
    });
  }

  return json<ActionData>({ error: "Acao invalida." }, { status: 400 });
}

export default function Login() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const error = actionData?.error || loaderData?.error;
  const success = actionData?.success;

  return (
    <div className="min-h-screen  text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-black  lg:flex lg:flex-col lg:justify-between lg:items-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,0,0,0.06),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(0,0,0,0.08),_transparent_40%)]" />
          <div className="relative flex items-center justify-center p-12 w-full h-full">
            <Logo color="white" className="w-72" onlyText />
          </div>
        </section>

        <section className="flex items-center justify-center text-black px-6 py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2 lg:hidden">
              <Logo color="white" className="w-48" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Login</h2>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/70 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-emerald-500/70 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {success}
              </div>
            ) : null}

            <Form method="post" className="space-y-4">
              <input type="hidden" name="_intent" value="password-login" />
              <div className="space-y-2">
                <Label htmlFor="identifier" >Username ou e-mail</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"

                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" >Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="flex items-center justify-between gap-4 text-sm text-zinc-400">
                <Link to="/reset-password" className="underline-offset-4 hover:text-white hover:underline">
                  Esqueci minha password
                </Link>
              </div>
              <Button type="submit" className="w-full">
                Entrar
              </Button>
            </Form>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Separator className="flex-1 bg-zinc-800" />
                <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">ou</span>
                <Separator className="flex-1 bg-zinc-800" />
              </div>

              <Form action="/auth/google" method="post">
                <Button type="submit" variant="secondary" className="w-full">
                  Acessar com Google
                </Button>
              </Form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
