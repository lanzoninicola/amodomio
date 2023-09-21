import { LoaderArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";

export async function loader() {
    return null
}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "category-create") {

    }
    return null
}


export default function DoughOutlet() {
    return (
        <Container>
            <div>
                Here the list of doughs
            </div>
            <Outlet />
        </Container>
    )
}