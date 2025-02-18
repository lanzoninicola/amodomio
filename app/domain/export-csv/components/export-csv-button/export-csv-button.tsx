import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ExportCsvButtonProps {
    cnContainer?: string;
    children?: React.ReactNode;
    context: string;
}
export default function ExportCsvButton({ cnContainer, children, context }: ExportCsvButtonProps) {
    return (
        <Link to={`/admin/export?format=csv&context=${context}`} download>
            <Button className={
                cn(
                    "transition-colors duration-200",
                    cnContainer
                )
            }>
                {children || "Exportar CSV"}
            </Button>
        </Link>

    )
}