import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";



export default function Games() {
    return (
        <div className="min-h-screen bg-brand-blue md:py-16 ">
            <Container clazzName="py-8">
                <div className="flex justify-center flex-col items-center gap-4 mb-8 md:mb-16">
                    <div className="w-[120px] md:w-[180px]">
                        <Logo />
                    </div>

                </div>
                <div className="p-4 md:max-w-prose md:mx-auto">
                    <Outlet />
                </div>
            </Container>
        </div>
    )
}