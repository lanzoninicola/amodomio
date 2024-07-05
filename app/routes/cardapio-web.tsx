import { Link, Outlet } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import Container from "~/components/layout/container/container";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";




export default function CardapioWeb() {
    return (
        <>
            <CardapioHeader />
            {/* <Featured /> */}
            <Outlet />
            <CardapioFooter />
        </>
    )
}

function CardapioHeader() {
    return (
        <header className="bg-white shadow fixed top-0 w-screen border-b-slate-100 px-4 py-3">
            <div className="flex justify-between items-center  ">
                <div className="flex gap-2 items-center">
                    <Link to="/cardapio-web">
                        <Logo color="black" className="w-[60px]" tagline={false} />
                    </Link>
                    <h1 className="font-semibold text-gray-900 font-body-website">Cardápio</h1>
                </div>
                <div className="flex gap-2 items-center">
                    <WhatsappExternalLink phoneNumber="46991272525"
                        ariaLabel="Envia uma mensagem com WhatsApp"
                        message={"Olá, gostaria fazer um pedido"}
                        className="flex flex-col gap-1 justify-center items-center"
                    >
                        <WhatsAppIcon color="black" />
                        {/* <span className="text-[10px] tracking-wide  font-body-website">Atendimento</span> */}
                    </WhatsappExternalLink>
                </div>
            </div>
        </header>
    )
}

function CardapioFooter() {
    return (
        <footer className="py-6 px-2 fixed bottom-0 w-screen">
            {/* <Separator className="my-4" /> */}
            <div className="px-2 w-full">
                <ExternalLink to="https://app.mogomenu.com.br/amodomio"
                    ariaLabel="Cardápio digital pizzaria A Modo Mio"
                    className="flex justify-between font-body-website rounded-sm bg-brand-green py-2 px-4"
                >
                    <span className="uppercase tracking-wide font-semibold">Fazer pedido</span>
                    <ArrowRight />
                </ExternalLink>
            </div>
        </footer>
    )
}