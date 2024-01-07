import { Link } from "@remix-run/react";
import { AlertTriangle } from "lucide-react";
import { ShoppingCart } from "lucide-react";
import { XCircle } from "lucide-react";
import ExternalLink from "~/components/primitives/external-link/external-link";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";



export default function FinalizarPedido() {
    return (
        <div className="absolute top-0 bottom-0 shadow-xl z-20 backdrop-blur-xl">
            <div className="bg-white rounded-xl py-8 px-4 shadow-xl m-6">
                <div className="flex flex-col gap-4">


                    <h1 className="font-accent font-semibold text-2xl uppercase mb-4 text-brand-blue">Guia para finalizar o pedido</h1>
                    <div className="flex flex-col">

                        <div className="flex flex-col gap-6 mb-6">
                            <p>Ao clicar no botão 'Fazer Pedido' abaixo, você será redirecionado ao nosso cardápio digital para fazer o seu pedido.</p>
                            <div>
                                <p className="font-semibold text-brand-blue font-accent uppercase text-lg">Lembre-se </p>
                                <p className="">
                                    Para escolher os sabores, é necessário selecionar o tamanho primeiro.</p>

                            </div>
                        </div>

                        <div className="grid place-items-center mb-12">
                            <div className="flex flex-col bg-slate-100 p-4 rounded-xl">
                                <div className="flex gap-2 items-center mb-1">
                                    <AlertTriangle className="self-start p-0 m-0" size={16} />
                                    <h3 className="text-xs text-slate-600 font-semibold">Observação</h3>
                                </div>
                                <span className="text-xs text-slate-600">Alguns sabores podem estar temporariamente indisponíveis no cardápio. Agradecemos pela compreensão!</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mb-8">
                            <WhatsappExternalLink phoneNumber="46991272525" ariaLabel="Envia uma mensagem com WhatsApp"
                                className="flex gap-2 border border-brand-blue  justify-center items-center py-2 rounded-lg"
                            >
                                <span className="uppercase text-lg font-accent tracking-wide text-center my-auto">Fale conosco</span>
                            </WhatsappExternalLink>
                            <ExternalLink to="https://app.mogomenu.com.br/amodomio" ariaLabel="Link para fazer o pedido"
                                className="flex gap-2 bg-brand-green justify-center items-center py-2 rounded-lg">
                                <ShoppingCart className="text-white" />
                                <span className="uppercase text-xl font-semibold font-accent tracking-wide text-center text-white my-auto">Fazer Pedido</span>
                            </ExternalLink>
                        </div>

                        <Link to="/cardapio" className="w-full flex justify-center">
                            <span className="text-sm font-semibold font-accent uppercase tracking-wide my-auto underline">Voltar</span>
                        </Link>

                    </div>
                </div>
            </div>
        </div>

    )
}