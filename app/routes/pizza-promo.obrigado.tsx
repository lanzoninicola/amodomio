import { LoaderArgs, LoaderFunction, redirect } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ok } from "assert";
import { promoPizzaPhotoEntity } from "~/domain/promo-pizza-photos/promo-pizza-photos.entity.server";
import tryit from "~/utils/try-it";
import { urlAt } from "~/utils/url";


export default function SinglePizzaPromoThankYou() {


    return (
        <div className="flex flex-col gap-6 mt-12">
            <div className="grid place-items-center">
                <img src="/images/pizza-promo/obrigado.svg" alt="Obrigado" width="300px" height="300px" />
            </div>
            <div className="flex flex-col items-center gap-4">
                <h1 className="text-xl font-semibold">Obrigado!</h1>
                <p className="text-center">Obrigado por ter participado da nossa iniciativa; esse gesto vai nos ajudar.</p>
            </div>
            <div className="flex flex-col gap-4">
                <Link to="/pizza-promo" className="border rounded-sm text-center text-sm py-2 px-8 text-gray-700 border-brand-blue w-max mx-auto">Voltar</Link>
            </div>
        </div>
    )
}

