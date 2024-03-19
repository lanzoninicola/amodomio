import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";



export default function CardapioPizzaAlTaglio() {
    return (
        <div className="bg-orange-50 ">
            <Container className="p-6 min-h-screen">
                <div className="flex flex-col mb-6">
                    <div className="flex flex-col justify-center items-center w-full md:pt-6">
                        <div className="w-[120px] mb-12">
                            <Logo color="black" />
                        </div>
                    </div>
                    <h1 className="font-accent font-semibold text-2xl leading-relaxed md:text-center md:text-4xl">Cardápio Pizza Al Taglio</h1>
                    <h2 className="">Escolha seus pedaços de pizza de hoje</h2>
                </div>
                <Outlet />
            </Container>
        </div>
    )
}