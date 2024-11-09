import { menuItemSize } from "@prisma/client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";


interface menuItemSizeSelectorProps {
    variations: menuItemSize[]
}

export default function menuItemSizeSelector({ variations }: menuItemSizeSelectorProps) {
    return (
        <Select name="menuItemSize" required>
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