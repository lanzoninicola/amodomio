import { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import PromoRules from "~/domain/promo-pizza-photos/components/promo-rules/promo-rules";

export const meta: MetaFunction = () => {
    return [
        { title: "Regulamento promo 'Fotos cardápio'" },
        {
            name: "description",
            content: "Regulamento da promo 'Fotos cardápio' do dia 05 de Março 2024",
        },
    ];
};

export default function SinglePizzaPromoThankYou() {

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-xl font-semibold">Regulamento</h1>
                <h2 className="text-lg">Promo "Fotos cardápio"</h2>
            </div>
            <div>
                <span>Regras:</span>
                <PromoRules />
            </div>
            <Link to="/pizza-promo" className="border rounded-sm w-full text-center text-sm py-2 text-gray-700 border-brand-blue">Voltar</Link>
        </div>
    )
}


