import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { lastUrlSegment, urlAt } from "~/utils/url";


export function loader({ request, params }: LoaderFunctionArgs) {

    const url = request.url
    const last = lastUrlSegment(request.url)

    // Fixing typo URL error
    if (last === "cardapio.") {
        return redirect('cardapio')
    }

    if (params['*'] === "admin/cardapio") {
        return redirect('/admin/gerenciamento/cardapio')
    }


    return redirect('/cardapio')
}