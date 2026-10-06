import { defer, json, redirect } from "@remix-run/node";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import {
  Await,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import { Suspense, useState } from "react";
import { ChevronLeft, FilePlus2 } from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import {
  deleteRecipeTemplate,
  getTemplateRecipe,
  listRecipeTemplates,
} from "~/domain/recipe/recipe-templates.server";
import { RecipeTemplateList } from "~/domain/recipe/components/recipe-template-list";
import { DeleteRecipeTemplateDialog } from "~/domain/recipe/components/delete-recipe-template-dialog";
import { Button } from "~/components/ui/button";
import type { ShouldRevalidateFunction } from "@remix-run/react";

export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}) =>
  !formMethod &&
  currentUrl.pathname === nextUrl.pathname &&
  currentUrl.search !== nextUrl.search
    ? false
    : defaultShouldRevalidate;

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: `Templates de ${
      data?.payload.recipe.name || "receita"
    } | Admin Mobile`,
  },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const recipe = await getTemplateRecipe(String(params.recipeId || ""));
  return defer({
    payload: { recipe },
    templates: listRecipeTemplates(recipe.id),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const recipeId = String(params.recipeId || "");
  if (!recipeId) return json({ error: "Receita inválida." }, { status: 400 });
  const form = await request.formData();
  if (form.get("intent") !== "delete-template")
    return json({ error: "Ação inválida." }, { status: 400 });
  return deleteRecipeTemplate(recipeId, form);
}

export default function RecipeTemplatesPage() {
  const data = useLoaderData<typeof loader>();
  const { recipe } = data.payload;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const recipePath = `/admin/mobile/receitas/${recipe.id}`;
  const listPath = `${recipePath}/templates`;
  const search = params.size ? `?${params}` : "";
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  return (
    <div className="space-y-4 pb-6">
      <Link
        to={`${recipePath}${search}`}
        className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-slate-600"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar à receita
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-slate-950">Templates</h2>
          <p className="mt-1 text-sm text-slate-500">{recipe.name}</p>
        </div>
        <Button asChild variant="outline" className="h-11 shrink-0">
          <Link to={`${listPath}/novo${search}`}>
            <FilePlus2 className="mr-2 h-4 w-4" /> Criar
          </Link>
        </Button>
      </div>
      <Suspense
        fallback={
          <p role="status" className="text-sm text-slate-500">
            Carregando templates…
          </p>
        }
      >
        <Await
          resolve={data.templates}
          errorElement={
            <p role="alert" className="text-sm text-red-600">
              Não foi possível carregar os templates. Atualize a página para
              tentar novamente.
            </p>
          }
        >
          {(templates) => (
            <RecipeTemplateList
              templates={templates}
              query={params.get("q") || ""}
              page={page}
              onQueryChange={(query) =>
                setParams(
                  (current) => {
                    current.set("q", query);
                    current.delete("page");
                    return current;
                  },
                  { replace: true }
                )
              }
              onPageChange={(nextPage) =>
                setParams(
                  (current) => {
                    if (nextPage) current.set("page", String(nextPage));
                    else current.delete("page");
                    return current;
                  },
                  { replace: true }
                )
              }
              onSelect={(template) =>
                navigate(`${listPath}/${template.id}${search}`)
              }
              onDelete={setDeleteTarget}
            />
          )}
        </Await>
      </Suspense>
      <DeleteRecipeTemplateDialog
        template={deleteTarget}
        recipeName={recipe.name}
        action={listPath}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
