

export interface NavItem {
    group?: "administração" | "cozinha" | "atendimento"
    label: string
    to: string
    disabled?: boolean
}



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