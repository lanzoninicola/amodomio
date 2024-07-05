import { Link } from "@remix-run/react";
import { cn } from "~/lib/utils";


interface MenuItemNavLinkProps {
    children: React.ReactNode;
    to: string;
    isActive?: boolean;
}

export default function MenuItemNavLink({ children, to, isActive }: MenuItemNavLinkProps) {
    return (

        <Link to={to}
            className={
                cn(
                    "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors hover:text-primary text-muted-foreground",
                    isActive && "bg-muted font-semibold text-black"
                )
            }>
            {children}
        </Link>

    )
}