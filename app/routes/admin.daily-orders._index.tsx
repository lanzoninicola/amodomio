import { V2_MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";


export const meta: V2_MetaFunction = () => [
    { name: "robots", content: "noindex" },
];


export default function AdminDailyOrdersOutlet() {
    return (
        <Container clazzName="mt-12">

            <Outlet />
        </Container>
    )
}