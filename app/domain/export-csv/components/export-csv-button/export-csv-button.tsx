import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ExportCsvButtonProps {
    cnContainer?: string;
    children?: React.ReactNode;
}
export default function ExportCsvButton({ cnContainer, children }: ExportCsvButtonProps) {
    return (
        <Link to="/admin/export-csv" download>
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