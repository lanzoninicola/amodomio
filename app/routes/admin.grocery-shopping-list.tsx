import { Link, Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";

export default function GroceryList() {
    return (
        <Container className="mt-12">
            <div className="w-full p-4 bg-muted mb-6" >
                <div className="flex justify-between mb-4 flex-wrap">
                    <h1 className="font-bold text-xl">Listas de mercado</h1>
                    <div className="flex flex-col gap-4">
                        <Link to="new" className="mr-4 py-2 px-4 rounded-md bg-black">
                            <span className=" text-white font-semibold">
                                Nova Lista
                            </span>
                        </Link>
                        <Link to="/admin/grocery-shopping-list" className="mr-4">
                            <span className="text-sm underline">Voltar</span>
                        </Link>
                    </div>
                </div>
            </div>
            <Outlet />
        </Container>
    )
}

