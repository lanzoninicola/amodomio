import { Link, Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";




export default function CardapioPizzaAlTaglio() {

    return (
        <Container className="mt-12">
            <div className="w-full p-6 bg-muted mb-2 rounded-lg" >
                <div className="flex justify-between mb-4 items-start">
                    <h1 className="font-bold text-xl">Cardapio Pizza Al Taglio</h1>
                    <div className="flex flex-col gap-4">
                        <Link to="new" className="mr-4 py-2 px-4 rounded-md bg-black">
                            <span className=" text-white font-semibold">
                                Novo dia
                            </span>
                        </Link>
                        <Link to="/admin/categorias" className="mr-4">
                            <span className="text-sm underline">Voltar</span>
                        </Link>
                    </div>
                </div>

            </div>

            <Outlet />
        </Container>
    )
}