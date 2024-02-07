import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";



export default function DailyPizzaAlTaglio() {
    return (
        <div className="bg-brand-blue min-h-screen text-white">
            <Container >
                <Outlet />
            </Container>
        </div>
    )
}