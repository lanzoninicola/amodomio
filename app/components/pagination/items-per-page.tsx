import { cn } from "~/lib/utils"
import { Link } from "@remix-run/react"

interface ItemsPerPageConfigProps {
    itemsPerPage: number[],
    defaultValue: number
}

interface ItemsPerPageProps {
    label?: string
    className?: string
    config: ItemsPerPageConfigProps
}

export default function ItemsPerPage({ label = "Itens por pagína:", className, config }: ItemsPerPageProps) {
    return (
        <div className="flex gap-2 items-center">
            <span className="text-xs">{label}</span>
            <ul className="flex gap-2">

                {
                    config.itemsPerPage.map(item => (
                        <li key={item} className={cn(
                            "text-xs font-semibold rounded-md px-2 py-1 cursor-pointer transition-colors duration-200 ease-in-out hover:bg-gray-100/50 text-gray",
                            className
                        )}>
                            <Link to={`?itemsPerPage=${item}`}>
                                {item}
                            </Link>
                        </li>
                    ))
                }
            </ul>
        </div>
    )
}