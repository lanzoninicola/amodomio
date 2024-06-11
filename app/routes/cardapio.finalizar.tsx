import { Link } from "@remix-run/react";
import { AlertTriangle, ExternalLinkIcon } from "lucide-react";
import { ShoppingCart } from "lucide-react";
import ExternalLink from "~/components/primitives/external-link/external-link";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import { Separator } from "~/components/ui/separator";



export default function FinalizarPedido() {
    return (
        <div className="absolute top-0 bottom-0 shadow-xl z-20 backdrop-blur-xl">
            <div className="bg-white rounded-xl py-8 px-4 shadow-xl m-6">
                <div className="flex flex-col gap-4">


                    <div className="mb-6">
                        <h1 className="font-bold text-lg uppercase mb-2">Guia para finalizar o pedido</h1>
                        <p>Ao clicar no botão <span className="font-semibold">Fazer Pedido</span> abaixo, você será redirecionado ao nosso cardápio digital para fazer o seu pedido.</p>
                    </div>
                    <div className="flex flex-col mb-6">
                        <p className="font-semibold  uppercase text-sm">Lembre-se </p>
                        <p>Para escolher os sabores, é necessário selecionar o tamanho primeiro.</p>

                    </div>



                    <ExternalLink to="https://app.mogomenu.com.br/amodomio" ariaLabel="Link para fazer o pedido"
                        className="flex gap-2 bg-slate-300 justify-center items-center py-4 rounded-lg mb-4">

                        <span className="uppercase text-lg font-semibold  tracking-wide text-center leading-none">Fazer Pedido</span>
                        <ExternalLinkIcon size={16} />
                    </ExternalLink>

                    <Separator className="my-4" />

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col mb-4">
                            <div className="flex gap-2 items-center mb-1">
                                <AlertTriangle className="self-start p-0 m-0" size={16} />
                                <h3 className="text-xs text-slate-600 font-semibold">Observação</h3>
                            </div>
                            <span className="text-xs text-slate-600">Alguns sabores podem estar temporariamente indisponíveis no cardápio. Agradecemos pela compreensão!</span>
                        </div>

                        <div className="flex justify-between">
                            <WhatsappExternalLink phoneNumber="46991272525" ariaLabel="Envia uma mensagem com WhatsApp"
                                className="w-full flex justify-center"
                            >
                                <span className="text-xs font-semibold  uppercase tracking-wide my-auto underline">Fale Conosco</span>
                            </WhatsappExternalLink>
                            <Link to="/cardapio" className="w-full flex justify-center">
                                <span className="text-xs font-semibold  uppercase tracking-wide my-auto underline">Voltar</span>
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </div>


    )
}