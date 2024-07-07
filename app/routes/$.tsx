import { LoaderArgs, redirect } from "@remix-run/node";
import { lastUrlSegment, urlAt } from "~/utils/url";


export function loader({ request, params }: LoaderArgs) {

    const url = request.url
    const last = lastUrlSegment(request.url)

    // Fixing typo URL error
    if (last === "cardapio.") {
        return redirect('cardapio')
    }

    if (params['*'] === "admin/cardapio") {
        return redirect('/admin/gerenciamento/cardapio')
    }


    return null
}