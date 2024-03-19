import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";



export default function DailyPizzaAlTaglio() {
    return (
        <div className="bg-orange-50 min-h-screen">
            <Container className="p-6">
                <div className="flex flex-col justify-center items-center w-full md:pt-6">
                    <div className="w-[120px] mb-12">
                        <Logo color="black" />
                    </div>

                </div>
                <h1 className="font-title font-semibold tracking-normal text-lg md:text-center md:text-2xl">Cardápio Pizza Al Taglio</h1>
                <Outlet />
            </Container>
        </div>
    )
}