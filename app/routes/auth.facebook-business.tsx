import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { createInstagramFacebookLogin } from "~/domain/instagram/instagram-facebook-login.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");

  const { authorizationUrl, setCookie } = await createInstagramFacebookLogin(
    request
  );
  return redirect(authorizationUrl, {
    headers: { "Set-Cookie": setCookie },
  });
}
