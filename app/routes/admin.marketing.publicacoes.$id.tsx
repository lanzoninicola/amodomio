import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  NavLink,
  Outlet,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { ChevronLeft, Trash2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  getContentPost,
  softDeleteContentPost,
} from "~/domain/content-post/content-post.server";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.post.title || "Publicação"} | Marketing` },
];

const navigation = [
  { label: "Conteúdo", to: "conteudo" },
  { label: "Mídias", to: "midias" },
  { label: "Cardápio", to: "cardapio" },
  { label: "WhatsApp", to: "whatsapp" },
  { label: "Instagram", to: "instagram" },
];

export async function loader({ params }: LoaderFunctionArgs) {
  return json({ post: await getContentPost(String(params.id || "")) });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const form = await request.formData();
  if (String(form.get("_intent") || "") !== "delete") {
    return json({ ok: false }, { status: 400 });
  }
  await softDeleteContentPost(String(params.id || ""));
  await invalidateCardapioIndexCache();
  throw redirect("/admin/marketing/publicacoes");
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

export default function ContentPostLayout() {
  const { post } = useLoaderData<typeof loader>();
  const navigationState = useNavigation();

  return (
    <div className="flex min-w-0 max-w-5xl flex-col gap-5 pb-12 sm:gap-6">
      <div className="space-y-4">
        <Link
          to="/admin/marketing/publicacoes"
          className="inline-flex items-center gap-1 text-sm font-semibold"
        >
          <ChevronLeft size={14} /> publicações
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="break-words text-xl font-semibold sm:text-2xl">
              {post.title}
            </h1>
            <Badge variant={post.status === "active" ? "default" : "secondary"}>
              {statusLabel[post.status] || post.status}
            </Badge>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="h-11 w-full text-red-700 sm:h-10 sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar publicação?</AlertDialogTitle>
                <AlertDialogDescription>
                  O cardápio será atualizado imediatamente. Publicações sociais
                  já exibidas aguardam a expiração quando a plataforma não
                  permite remoção.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Form method="post">
                <input type="hidden" name="_intent" value="delete" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={navigationState.state === "submitting"}
                    >
                      Eliminar publicação
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </Form>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <nav className="-mx-3 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-5">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center border-b-2 text-sm font-medium ${
                  isActive
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
