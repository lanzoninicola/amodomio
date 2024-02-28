import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";

export default function PizzaPromoOutlet() {

    return (
        <Container className="md:mt-12">
            <Outlet />
        </Container>
    )
}
