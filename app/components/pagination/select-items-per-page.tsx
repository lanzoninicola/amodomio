import { cn } from "~/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface SelectItemsPerPageConfigProps {
    itemsPerPage: number[],
    defaultValue: number
}

interface SelectItemsPerPageProps {
    name: string
    className?: string
    config: SelectItemsPerPageConfigProps
}

export default function SelectItemsPerPage({ name, className, config }: SelectItemsPerPageProps) {
    return (
        <Select name={name} required defaultValue={String(config.defaultValue)}>
            <SelectTrigger className={
                cn(className)
            } >
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent id={name} >
                <SelectGroup >
                    {config.itemsPerPage.map(item => (
                        <SelectItem key={item} value={String(item)}>{item}</SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}