import { cn } from "~/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface SelectPageNumberConfigProps {
    totalPages: number,
    defaultValue: number
}

interface SelectPageNumberProps {
    name: string
    className?: string
    config: SelectPageNumberConfigProps
}

export default function SelectPageNumber({ name, className, config }: SelectPageNumberProps) {
    return (
        <Select name={name} required defaultValue={String(config.defaultValue)}>
            <SelectTrigger className={
                cn(className)
            } >
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent id={name} >
                <SelectGroup >
                    {Array.from({ length: config.totalPages }, (_, i) => i + 1).map(page => (
                        <SelectItem key={page} value={String(page)}>{page}</SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}