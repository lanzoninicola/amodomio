import { Link, Outlet } from "@remix-run/react";
import { Plus } from "lucide-react";
import Container from "~/components/layout/container/container";
import { Button } from "~/components/ui/button";



export default function ProductsOutlet() {
    return (
        <Container className="mt-12">
            <div className="lw-full p-4 bg-muted mb-6" >
                <div className="flex justify-between mb-4">
                    <h1 className="font-bold text-xl">Produtos</h1>
                    <div className="flex flex-col gap-4">
                        <Link to="/new" className="mr-4 py-2 px-4 rounded-md bg-black">
                            <span className=" text-white font-semibold">
                                Novo Produto
                            </span>
                        </Link>
                        <Link to="/admin/products" className="mr-4">
                            <span className="text-sm underline">Voltar</span>
                        </Link>
                    </div>
                </div>
            </div>
            <Outlet />
        </Container>
    )
}

