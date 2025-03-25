import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";

import { cn } from "~/lib/utils";


export default function CardapioExport() {
    return (
        <ul>
            <Link to={`/admin/gerenciamento/cardapio/export/menu-items-price-variations`} download>
                <Button className={
                    cn(
                        "transition-colors duration-200",

                    )
                }>
                    Preços de venda
                </Button>
            </Link>
        </ul>
    )
}