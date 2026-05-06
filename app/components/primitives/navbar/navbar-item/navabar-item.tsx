import { NavLink } from "@remix-run/react"


export interface NavbarItemProps {
    label: string
    href: string
}

export default function NavbarItem({ label, href }: NavbarItemProps) {
    return (
        <NavLink to={href}>
            <div className="hover:rounded-lg hover:bg-muted px-6 py-2 shrink-0 whitespace-nowrap">
                <span className="text-2xl md:text-sm lg:text-base font-semibold">{label}</span>
            </div>
        </NavLink>
    )
}
