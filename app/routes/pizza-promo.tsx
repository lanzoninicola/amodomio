import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";

export default function PizzaPromoOutlet() {

    return (
        <Container className="md:mt-12">
            <div className="flex justify-center w-full">
                <div className="w-[120px] md:w-[180px] mb-6">
                    <Logo color="black" />
                </div>
            </div>
            <Outlet />
        </Container>
    )
}
