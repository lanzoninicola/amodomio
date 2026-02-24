import type { LoaderFunctionArgs } from "@remix-run/node";
import { type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { Trash2 } from "lucide-react";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import type { Category } from "~/domain/category/category.model.server";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";

export const meta: MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        {
            name: "title",
            content: "Categorias | A Modo Mio",
        }
    ];
};


export async function loader() {
    const categories = await categoryPrismaEntity.findAll()
    return ok({ categories })
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "category-edit") {

        const category: Category = {
            id: values.id as string,
            name: values.name as string,
            type: "menu",
        }

        await categoryPrismaEntity.update(values.id as string, category)
    }


    if (_action === "item-sortorder-up") {
        await categoryPrismaEntity.sortUp(values.id as string)
    }

    if (_action === "item-sortorder-down") {
        await categoryPrismaEntity.sortDown(values.id as string)
    }

    return null
}

export default function AdminCategoriasIndex() {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]
    const [searchParams] = useSearchParams()
    const action = searchParams.get("_action")
    const isSortMode = action === "categories-sortorder"

    const categoriesSorted = [...categories].sort((a, b) => (a?.sortOrder || 0) - (b?.sortOrder || 0))

    if (categoriesSorted.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categorias</div>
                    <div className="text-sm text-slate-500">Nenhum registro encontrado</div>
                </div>
                <div className="rounded-xl border border-dashed border-slate-200 p-2">
                    <NoRecordsFound
                        text="Nenhuma categoria cadastrada"
                        additionalInfo="Crie uma categoria para começar."
                        clazzName="m-0 py-6"
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categorias</div>
                        <div className="text-2xl font-black text-slate-900 tabular-nums">{categoriesSorted.length}</div>
                        <p className="text-xs text-slate-500">
                        {isSortMode
                            ? "Modo de ordenação ativo. Use as setas para reordenar."
                            : "Selecione uma categoria para editar."}
                        </p>
                    </div>
                    <Badge
                        variant={isSortMode ? "default" : "secondary"}
                        className={cn("w-max", !isSortMode && "border-slate-200 bg-slate-100 text-slate-700")}
                    >
                        {isSortMode ? "Ordenação ativa" : "Lista"}
                    </Badge>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
                <Table className="min-w-[760px]">
                    <TableHeader className="bg-slate-50/90">
                        <TableRow className="hover:bg-slate-50/90">
                            <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</TableHead>
                            <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                            <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ordem</TableHead>
                            <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categoriesSorted.map((category) => (
                            <CategoryRow key={category.id} category={category} />
                        ))}
                    </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                    <span>0 of {categoriesSorted.length} row(s) selected.</span>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-slate-700">Rows per page</span>
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{categoriesSorted.length}</Badge>
                        <span className="text-xs font-semibold text-slate-900">Page 1 of 1</span>
                    </div>
                </div>
            </div>
        </div>
    )
}






interface CategoryItemProps {
    category: Category
}

function CategoryRow({ category }: CategoryItemProps) {
    const [searchParams] = useSearchParams()
    const action = searchParams.get("_action")
    const isSortMode = action === "categories-sortorder"

    return (
        <TableRow className="border-slate-100 hover:bg-slate-50/50">
            <TableCell className="px-4 py-3">
                <SortingOrderItems enabled={action === "categories-sortorder"} itemId={category.id}>
                    <Link
                        to={`${category.id}`}
                        className={cn(
                            "block rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                            !isSortMode && "hover:bg-slate-50"
                        )}
                    >
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-semibold text-slate-900">{category.name}</span>
                            <span className="text-xs text-slate-500">ID: {category.id}</span>
                        </div>
                    </Link>
                </SortingOrderItems>
            </TableCell>
            <TableCell className="px-4 py-3">
                <Badge
                    className={cn(
                        "w-max",
                        category.type === "menu" ? "bg-brand-green" : "bg-brand-blue",
                    )}
                >
                    {category.type}
                </Badge>
            </TableCell>
            <TableCell className="px-4 py-3 text-right font-medium text-slate-800">{category.sortOrder ?? 0}</TableCell>
            <TableCell className="px-4 py-3 text-right">
                <Button asChild variant="ghost" size="icon" className="text-slate-500 hover:text-red-600">
                    <Link to={`${category.id}#delete-category`} aria-label={`Excluir categoria ${category.name}`} title="Excluir categoria">
                        <Trash2 className="h-4 w-4" />
                    </Link>
                </Button>
            </TableCell>
        </TableRow>
    )
}
