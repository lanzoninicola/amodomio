import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator, sessionStorage } from "~/domain/auth/google.server";
import prismaClient from "~/lib/prisma/client.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, { status: 405 });
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: "Origem inválida." }, { status: 403 });
  }
  const currentUser = await authenticator.isAuthenticated(request);
  if (!currentUser) {
    return authenticator.logout(request, { redirectTo: "/login" });
  }

  try {
    const email = String(currentUser.email || "").trim().toLowerCase();
    const user = currentUser.id
      ? await prismaClient.userAccess.findUnique({ where: { id: currentUser.id } })
      : email
        ? await prismaClient.userAccess.findFirst({ where: { email } })
        : null;

    if (!user) {
      return json({ error: "Seu login não está vinculado a um cadastro de usuário. Informe seu e-mail ao responsável pelo sistema e solicite a vinculação." }, { status: 403 });
    }
    if (!user.isActive) {
      return authenticator.logout(request, { redirectTo: "/login" });
    }

    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    session.set(authenticator.sessionKey, {
      id: user.id,
      username: user.username,
      name: user.name || currentUser.name,
      email: user.email || email,
      avatarURL: user.avatarUrl || currentUser.avatarURL,
      roles: user.roles,
    });
    return json(
      { success: "Sessão atualizada. Suas permissões foram recarregadas." },
      { headers: { "Set-Cookie": await sessionStorage.commitSession(session), "Cache-Control": "no-store" } }
    );
  } catch {
    return json(
      { error: "Não foi possível atualizar a sessão. Tente novamente." },
      { status: 503 }
    );
  }
}
