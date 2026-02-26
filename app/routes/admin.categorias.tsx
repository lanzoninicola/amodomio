import { Link, Outlet, useSearchParams } from "@remix-run/react";
import { ChevronLeft, PlusCircle } from "lucide-react";
import Container from "~/components/layout/container/container";
import { Separator } from "~/components/ui/separator";

export default function AdminCategorias() {
    const [searchParams] = useSearchParams()
    const action = searchParams.get("_action")
    const isSortMode = action === "categories-sortorder"


    return (
        <Container fullWidth className="mt-12 px-4">
            <div className="flex flex-col gap-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <Link
                                to="/admin"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
                            >
                                <ChevronLeft size={14} />
                                Voltar
                            </Link>
                            <h1 className="text-xl font-black tracking-tight text-slate-900">Categorias</h1>
                            <p className="text-sm text-slate-500">Cadastro e ordenação das categorias do cardápio.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                to={isSortMode ? "/admin/categorias" : "?_action=categories-sortorder"}
                                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                {isSortMode ? "Fechar ordenação" : "Ordenamento"}
                            </Link>

                            <Link
                                to="new"
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
                            >
                                <PlusCircle size={16} />
                                Nova Categoria
                            </Link>
                        </div>
                    </div>
                    <Separator className="mt-4" />
                </section>

                <Outlet />
            </div>
            
            
            
            
            
            
            
        </Container>

    )
}
