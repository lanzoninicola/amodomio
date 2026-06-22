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
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.section.title || "Destaque"} | Marketing` },
];

const navigation = [
  { label: "Conteúdo", to: "conteudo" },
  { label: "Aparência", to: "aparencia" },
  { label: "Imagens", to: "imagens" },
  { label: "WhatsApp", to: "whatsapp" },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const id = String(params.id || "");
  const section = await prismaClient.cardapioHighlightSection.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      published: true,
      deletedAt: true,
    },
  });

  if (!section) throw new Response("Destaque não encontrado", { status: 404 });

  return json({ section });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const form = await request.formData();

  if (String(form.get("_intent") || "") !== "delete") {
    return json({ ok: false, message: "Ação inválida." }, { status: 400 });
  }

  await prismaClient.cardapioHighlightSection.update({
    where: { id },
    data: { deletedAt: new Date(), published: false },
  });
  await invalidateCardapioIndexCache();
  throw redirect("/admin/marketing/destaques-cardapio");
}

function StatusBadge({
  published,
  deletedAt,
}: {
  published: boolean;
  deletedAt: string | null;
}) {
  if (deletedAt) return <Badge variant="secondary">Arquivado</Badge>;
  if (published) {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Publicado
      </Badge>
    );
  }
  return <Badge variant="outline">Rascunho</Badge>;
}

export default function AdminMarketingCardapioHighlightLayout() {
  const { section } = useLoaderData<typeof loader>();
  const navigationState = useNavigation();
  const isSubmitting = navigationState.state === "submitting";

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-5 pb-12 sm:gap-6">
      <div className="space-y-4">
        <Link
          to="/admin/marketing/destaques-cardapio"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
        >
          <ChevronLeft size={14} />
          destaques
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              {section.title}
            </h1>
            <StatusBadge
              published={section.published}
              deletedAt={section.deletedAt}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                className="h-11 w-full text-red-700 hover:bg-red-50 hover:text-red-800 sm:h-10 sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar destaque?</AlertDialogTitle>
                <AlertDialogDescription>
                  O destaque será removido da lista e despublicado do cardápio.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Form
                method="post"
                action={`/admin/marketing/destaques-cardapio/${section.id}`}
              >
                <input type="hidden" name="_intent" value="delete" />
                <AlertDialogFooter className="gap-2 sm:gap-0">
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button type="submit" variant="destructive">
                      Eliminar destaque
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </Form>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <nav className="-mx-3 overflow-x-auto border-b border-slate-200 px-3 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-5 sm:gap-6">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "inline-flex min-h-11 items-center border-b-2 px-0 text-sm font-medium transition",
                  isActive
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400 hover:text-slate-700",
                ].join(" ")
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
