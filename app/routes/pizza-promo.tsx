import { V2_MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";


export const meta: V2_MetaFunction = () => {
    return [
        { title: "Promo 'Fotos cardápio'" },
        {
            name: "description",
            content: "Precisamos de fotos autênticas para nosso cardápio e quem melhor para nos ajudar do que nossos valiosos clientes?",
        },
    ];
};

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
