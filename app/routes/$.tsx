import { LoaderArgs, redirect } from "@remix-run/node";
import { lastUrlSegment, urlAt } from "~/utils/url";


export function loader({ request, params }: LoaderArgs) {

    const urlSegment = lastUrlSegment(request.url)

    // Fixing typo URL error
    if (urlSegment === "cardapio.") {
        return redirect('cardapio')
    }

    return null
}