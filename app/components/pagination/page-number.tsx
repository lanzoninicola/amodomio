import { cn } from "~/lib/utils"
import { Link } from "@remix-run/react"

interface PageNumberConfigProps {
    totalPages: number,
    defaultValue: number
}

interface PageNumberProps {
    label?: string
    className?: string
    config: PageNumberConfigProps
}

export default function PageNumber({ label = "Numero pagína:", className, config }: PageNumberProps) {
    return (
        <div className="flex gap-2 items-center">
            <span className="text-xs">{label}</span>
            <ul className="flex gap-2">
                {Array.from({ length: config.totalPages }, (_, i) => i + 1).map(page => (
                    <li key={page} className={cn(
                        "text-xs font-semibold rounded-md px-2 py-1 cursor-pointer transition-colors duration-200 ease-in-out hover:bg-gray-100/50 text-gray",
                        className
                    )}>
                        <Link to={`?page=${page}`}>
                            {page}
                        </Link>
                    </li>
                ))}


            </ul>
        </div>
    )
}