import { Link, Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";

export default function CardapioPizzaAlTaglio() {
    return (
        <Container>
            <div className="w-full p-6 bg-muted mb-2 rounded-lg" >
                <div className="flex justify-between mb-4 items-start">
                    <div className="flex flex-col gap-4">
                        <h1 className="font-bold text-xl">Cardapio Pizza Al Taglio</h1>
                        <div className="flex gap-4 justify-between md:justify-start">
                            <Link to="new" className="py-2 px-4 rounded-md bg-black">
                                <span className=" text-white font-semibold">
                                    Novo cardapio
                                </span>
                            </Link>
                            <Link to="/admin/pizza-al-taglio" className="py-2 px-4 rounded-md border border-black">
                                <span className="font-semibold">
                                    Pizzas Al Taglio
                                </span>
                            </Link>
                        </div>

                    </div>
                    <Link to="/admin/cardapio-pizza-al-taglio" className="mr-4">
                        <span className="text-sm underline">Voltar</span>
                    </Link>

                </div>

            </div>

            <Outlet />
        </Container>
    )
}