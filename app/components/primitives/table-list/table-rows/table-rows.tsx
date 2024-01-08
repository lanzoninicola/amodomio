import { cn } from "~/lib/utils"


interface TableRowsProps {
    children: React.ReactNode
    className?: string
}

export default function TableRows({ children, className }: TableRowsProps) {
    return (
        <ul
            data-element="table-rows"
            className={
                cn(
                    className
                )
            }
        >
            {children}
        </ul>
    )
}