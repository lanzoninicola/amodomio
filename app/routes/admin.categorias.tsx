import { Link, Outlet, useSearchParams } from "@remix-run/react";
import Container from "~/components/layout/container/container";



export default function AdminCategorias() {
    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")


    return (
        <Container className="mt-12">
            <div className="lw-full p-4 bg-muted mb-6" >
                <div className="flex categories-center justify-between mb-4 items-center">
                    <h1 className="font-bold text-xl">Categorias</h1>
                    <Link to="/new" className="mr-4">
                        <span className=" text-white font-semibold rounded-md bg-black py-2 px-4">Criar categoria</span>
                    </Link>
                </div>
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