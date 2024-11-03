import { MenuItemSizeVariation } from "@prisma/client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";


interface MenuItemSizeVariationsSelectorProps {
    variations: MenuItemSizeVariation[]
}

export default function MenuItemSizeVariationsSelector({ variations }: MenuItemSizeVariationsSelectorProps) {
    return (
        <Select name="menuItemSizeVariations" required>
            <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent >
                <SelectGroup >
                    {
                        variations.map(sv => (
                            <SelectItem key={sv.id} value={sv.id}>{sv.label}</SelectItem>
                        ))
                    }
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}