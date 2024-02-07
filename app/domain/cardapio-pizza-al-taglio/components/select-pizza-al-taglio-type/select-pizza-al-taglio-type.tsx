import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";

interface SelectPizzaAlTaglioCategoryProps {
    name: string
    className?: string
}
export default function SelectPizzaAlTaglioCategory({ name, className }: SelectPizzaAlTaglioCategoryProps) {
    return (
        <Select name={name} required defaultValue="vegetariana">
            <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent id="category" className={
                cn(className)
            } >
                <SelectGroup >
                    <SelectItem value="margherita">Margherita</SelectItem>
                    <SelectItem value="vegetariana">Vegetariana</SelectItem>
                    <SelectItem value="carne">Carne</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}