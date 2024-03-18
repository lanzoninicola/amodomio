import { NavItem } from "~/domain/website-navigation/nav-items.constant"






interface AppMenuProps {
    navItems: NavItem[]
}

export default function AppMenu({ navItems }: AppMenuProps) {
    return (
        <ul>
            {navItems.map((item, index) => {
                return <li key={index}>{item.label}</li>
            })}

        </ul>
    )
}