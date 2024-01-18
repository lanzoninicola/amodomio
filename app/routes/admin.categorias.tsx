import { Link, Outlet, useSearchParams } from "@remix-run/react";
import Container from "~/components/layout/container/container";



export default function AdminCategorias() {
    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")


    return (
        <Container className="mt-12">
            <div className="w-full p-6 bg-muted mb-2 rounded-lg" >
                <div className="flex justify-between mb-4 items-start">
                    <h1 className="font-bold text-xl">Categorias</h1>
                    <div className="flex flex-col gap-4">
                        <Link to="new" className="mr-4 py-2 px-4 rounded-md bg-black">
                            <span className=" text-white font-semibold">
                                Nova Categoria
                            </span>
                        </Link>
                        <Link to="/admin/categorias" className="mr-4">
                            <span className="text-sm underline">Voltar</span>
                        </Link>
                    </div>
                </div>

            </div>

            <div className="w-full p-4 bg-muted mb-6 rounded-lg" >
                <div className="flex gap-2">
                    <Link to="?_action=categories-sortorder" className="mr-4">
                        <span className="text-sm underline">Ordenamento</span>
                    </Link>
                    {action === "categories-sortorder" && (
                        <Link to="/admin/categorias" className="mr-4">
                            <span className="text-sm underline">Fechar Ordenamento</span>
                        </Link>
                    )}
                </div>
            </div>


            <Outlet />
        </Container>
    )
}