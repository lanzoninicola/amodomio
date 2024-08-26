import { MetaFunction } from "@remix-run/node";
import { Outlet, useOutletContext } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { AdminOutletContext } from "./admin";


export const meta: MetaFunction = () => [
    { name: "robots", content: "noindex" },
];


export default function AdminDailyOrdersOutlet() {
    const adminOutletContext = useOutletContext<AdminOutletContext>()

    return (
        <Container clazzName="mt-12">

            <Outlet context={
                { ...adminOutletContext }
            } />
        </Container>
    )
}