import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";

import Container from "~/components/layout/container/container";

export const meta: MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        {
            name: "title",
            content: "Calcolo Biga | A Modo Mio",
        }
    ];
};

export async function loader() {
    return null
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "category-create") {

    }
    return null
}



export default function DoughIndex() {
    return (
        <Container>
            <div className="flex justify-between items-center mb-6">
                <Link to="/dough" >
                    <h1>Impasti</h1>
                </Link>
                <Link to="/dough/new" className="mr-4">
                    <span className="text-sm underline">Nuovo Impasto</span>
                </Link>
            </div>
            <Outlet />
        </Container>
    )

}