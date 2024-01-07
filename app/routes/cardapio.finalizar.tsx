import { Link } from "@remix-run/react";
import { AlertTriangle } from "lucide-react";
import { ShoppingCart } from "lucide-react";
import { XCircle } from "lucide-react";
import ExternalLink from "~/components/primitives/external-link/external-link";



export default function FinalizarPedido() {
    return (
        <div className="absolute top-0 bottom-0 shadow-xl z-20 backdrop-blur-sm">
            <div className="bg-brand-blue rounded-xl py-8 px-4 shadow-xl m-6">
                <div className="flex flex-col gap-4">


                    <h1 className="font-accent font-semibold text-2xl text-white uppercase mb-4">Guia para finalizar o pedido</h1>
                    <div className="flex flex-col">

                        <div className="flex flex-col gap-6 mb-6">
                            <p className="text-white ">Ao clicar no botão abaixo "Fazer pedido", você será direçionado ao nosso cardápio digital.</p>
                            <div>
                                <p className="font-semibold text-brand-orange font-accent uppercase text-lg">Lembre-se </p>
                                <p className="text-white ">
                                    Para escolher os sabores, é necessário selecionar o tamanho primeiro.</p>

                            </div>
                        </div>

                        <div className="grid place-items-center mb-12">
                            <div className="flex gap-2 items-center bg-brand-orange p-4 rounded-xl">
                                <AlertTriangle className="self-start text-white p-0 m-0" size={24} />
                                <span className="text-white text-sm font-semibold">Alguns sabores podem estar temporariamente indisponíveis no cardápio. Agradecemos pela compreensão!</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Link to="/cardapio"
                                className="flex gap-2 border-2 border-brand-orange justify-center items-center py-2 rounded-lg">
                                <span className="uppercase text-xl font-semibold font-accent tracking-wide text-center text-white my-auto">Voltar</span>

                            </Link>
                            <ExternalLink to="https://app.mogomenu.com.br/amodomio" ariaLabel="Link para fazer o pedido"
                                className="flex gap-2 bg-brand-orange justify-center items-center py-2 rounded-lg">
                                <ShoppingCart className="text-white" />
                                <span className="uppercase text-xl font-semibold font-accent tracking-wide text-center text-white my-auto">Fazer Pedido</span>
                            </ExternalLink>
                        </div>

                    </div>
                </div>
            </div>
        </div>

    )
}