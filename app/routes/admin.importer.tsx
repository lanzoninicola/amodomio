import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";



export default function Importer() {

    return (
        <Container>
            <h1 className="text-3xl font-semibold mb-6">Importador de dados</h1>
            <Outlet />
        </Container>
    )
}